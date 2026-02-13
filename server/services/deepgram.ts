import WebSocket from "ws";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(): void {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile();

function resolveApiKey(): string | null {
  if (process.env.DEEPGRAM_API_KEY) return process.env.DEEPGRAM_API_KEY;
  try {
    const cfg = JSON.parse(
      readFileSync(resolve(process.cwd(), ".opencode/opencode.json"), "utf-8"),
    );
    return cfg?.provider?.deepgram?.options?.apiKey ?? null;
  } catch {
    return null;
  }
}

const DG_PARAMS = new URLSearchParams({
  model: "nova-2",
  diarize: "true",
  smart_format: "true",
  interim_results: "true",
  endpointing: "300",
});

export function bridgeToDeepgram(
  browserWs: WebSocket,
  onError: (msg: string) => void,
): { cleanup: () => void } | null {
  const apiKey = resolveApiKey();
  console.log("[deepgram] apiKey resolved:", apiKey ? `${apiKey.slice(0, 6)}...` : "NONE");
  if (!apiKey) {
    onError("No DEEPGRAM_API_KEY found in env or .opencode/opencode.json");
    return null;
  }

  const dgUrl = `wss://api.deepgram.com/v1/listen?${DG_PARAMS}`;
  const dg = new WebSocket(dgUrl, {
    headers: { Authorization: `Token ${apiKey}` },
  });

  let closed = false;
  let dgReady = false;
  const earlyBuffer: Buffer[] = []; // buffer audio until DG socket is open

  dg.on("open", () => {
    console.log("[deepgram] connected");
    dgReady = true;
    // Flush any audio that arrived before DG was ready (includes the critical WebM header)
    for (const chunk of earlyBuffer) {
      dg.send(chunk);
    }
    console.log(`[deepgram] flushed ${earlyBuffer.length} buffered chunks`);
    earlyBuffer.length = 0;
  });

  let resultCount = 0;
  dg.on("message", (data) => {
    const msg = data.toString();
    const parsed = JSON.parse(msg);
    if (parsed.type === "Results") {
      resultCount++;
      const alt = parsed.channel?.alternatives?.[0];
      const txt = alt?.transcript ?? "";
      // Log full payload for first 5 results to debug empty transcripts
      if (resultCount <= 5) {
        console.log("[deepgram] FULL result #" + resultCount + ":", JSON.stringify({
          transcript: txt,
          is_final: parsed.is_final,
          speech_final: parsed.speech_final,
          words: alt?.words?.length ?? 0,
          confidence: alt?.confidence,
          channel_index: parsed.channel_index,
          duration: parsed.duration,
          start: parsed.start,
          model_info: parsed.metadata?.model_info,
        }));
      } else if (txt) {
        console.log("[deepgram] transcript:", JSON.stringify(txt), "is_final:", parsed.is_final, "speech_final:", parsed.speech_final);
      }
    } else if (parsed.type === "Metadata") {
      console.log("[deepgram] metadata:", JSON.stringify({
        request_id: parsed.request_id,
        model_info: parsed.model_info,
        model_uuid: parsed.model_uuid,
      }));
    } else {
      console.log("[deepgram] msg type:", parsed.type);
    }
    if (!closed && browserWs.readyState === WebSocket.OPEN) {
      browserWs.send(msg);
    }
  });

  dg.on("error", (err) => {
    console.error("[deepgram] error:", err.message);
    if (!closed) onError(`Deepgram error: ${err.message}`);
  });

  dg.on("close", (code, reason) => {
    console.log("[deepgram] disconnected, code:", code, "reason:", reason.toString());
    if (!closed && browserWs.readyState === WebSocket.OPEN) {
      browserWs.close();
    }
  });

  let audioChunks = 0;
  browserWs.on("message", (data, isBinary) => {
    if (closed) return;
    if (isBinary) {
      audioChunks++;
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
      if (audioChunks <= 3 || audioChunks % 20 === 0) {
        const hex = buf.subarray(0, 16).toString("hex");
        console.log(`[deepgram] audio chunk #${audioChunks}, ${buf.length} bytes, dg.readyState=${dg.readyState}, head: ${hex}`);
      }
      if (dgReady) {
        dg.send(data);
      } else {
        earlyBuffer.push(buf);
      }
    } else {
      const text = data.toString();
      try {
        const msg = JSON.parse(text);
        if (msg.type === "CloseStream") {
          dg.send(JSON.stringify({ type: "CloseStream" }));
        }
      } catch {
        // ignore non-JSON text frames
      }
    }
  });

  const cleanup = () => {
    closed = true;
    if (dg.readyState === WebSocket.OPEN || dg.readyState === WebSocket.CONNECTING) {
      dg.close();
    }
  };

  return { cleanup };
}
