import { create } from "zustand";

export interface TranscriptSegment {
  id: string;
  text: string;
  speaker: number;
  isFinal: boolean;
  start: number;
  end: number;
}

export interface SpeakerInfo {
  index: number;
  name: string;
  color: string;
}

type MicStatus = "off" | "requesting" | "on" | "error";

interface TranscriptState {
  micStatus: MicStatus;
  error: string | null;
  segments: TranscriptSegment[];
  interimSegment: TranscriptSegment | null;
  speakers: Record<number, SpeakerInfo>;
  pendingUtterance: string;
  flushedCount: number; // segments[0..flushedCount-1] are committed utterances
  startMic: () => void;
  stopMic: () => void;
  renameSpeaker: (index: number, name: string) => void;
  clearTranscript: () => void;
}

const SPEAKER_COLORS = [
  "#60a5fa", // blue
  "#f472b6", // pink
  "#4ade80", // green
  "#fbbf24", // amber
  "#a78bfa", // purple
  "#fb923c", // orange
  "#2dd4bf", // teal
  "#f87171", // red
];

// Browser resources kept outside Zustand to avoid serialization issues
let mediaStream: MediaStream | null = null;
let mediaRecorder: MediaRecorder | null = null;
let socket: WebSocket | null = null;
let safetyTimer: ReturnType<typeof setTimeout> | null = null;

// Utterance buffer: accumulates is_final chunks until speech_final flushes them
let utteranceBuffer: string[] = [];

// Safety net: if speech_final never comes (e.g. mic stops mid-sentence),
// flush after 8s of no new is_final chunks
const SAFETY_TIMEOUT_MS = 8000;

function clearSafetyTimer() {
  if (safetyTimer !== null) {
    clearTimeout(safetyTimer);
    safetyTimer = null;
  }
}

function resetSafetyTimer() {
  clearSafetyTimer();
  safetyTimer = setTimeout(() => {
    flushUtteranceBuffer();
  }, SAFETY_TIMEOUT_MS);
}

function flushUtteranceBuffer() {
  clearSafetyTimer();
  const text = utteranceBuffer.join(" ").trim();
  utteranceBuffer = [];
  if (text) {
    window.dispatchEvent(
      new CustomEvent("transcript:flush", { detail: { text } }),
    );
  }
  const { segments } = useTranscriptStore.getState();
  useTranscriptStore.setState({ pendingUtterance: "", flushedCount: segments.length });
}

function flushPending() {
  flushUtteranceBuffer();
}

function ensureSpeaker(speakerIndex: number) {
  const { speakers } = useTranscriptStore.getState();
  if (speakers[speakerIndex]) return;
  const color = SPEAKER_COLORS[speakerIndex % SPEAKER_COLORS.length];
  useTranscriptStore.setState({
    speakers: {
      ...speakers,
      [speakerIndex]: {
        index: speakerIndex,
        name: `Speaker ${speakerIndex}`,
        color,
      },
    },
  });
}

let segmentCounter = 0;

function handleDeepgramMessage(event: MessageEvent) {
  try {
    const data = JSON.parse(event.data);

    if (data.type === "Error") {
      useTranscriptStore.setState({ micStatus: "error", error: data.message });
      return;
    }

    if (data.type !== "Results") return;

    const alt = data.channel?.alternatives?.[0];
    if (!alt) return;

    const transcript = (alt.transcript as string) ?? "";
    const hasText = transcript.trim().length > 0;

    // Empty results — clear interim, ignore for batching
    if (!hasText) {
      if (!data.is_final) {
        useTranscriptStore.setState({ interimSegment: null });
      }
      return;
    }

    const words = alt.words as Array<{ speaker: number; start: number; end: number }> | undefined;
    const speakerIndex = words?.[0]?.speaker ?? 0;
    const start = words?.[0]?.start ?? data.start;
    const end = words?.[words.length - 1]?.end ?? start + data.duration;

    ensureSpeaker(speakerIndex);

    const segment: TranscriptSegment = {
      id: `seg-${segmentCounter++}`,
      text: transcript,
      speaker: speakerIndex,
      isFinal: !!data.is_final,
      start,
      end,
    };

    if (data.is_final) {
      // Buffer this finalized chunk
      utteranceBuffer.push(transcript);
      const buffered = utteranceBuffer.join(" ").trim();

      useTranscriptStore.setState((s) => ({
        segments: [...s.segments, segment],
        interimSegment: null,
        pendingUtterance: buffered,
      }));

      if (data.speech_final) {
        // Natural pause detected — flush the complete utterance
        flushUtteranceBuffer();
      } else {
        // More speech expected — reset safety timer
        resetSafetyTimer();
      }
    } else {
      // Interim — show in overlay but don't accumulate
      useTranscriptStore.setState({ interimSegment: segment });
    }
  } catch {
    // Ignore malformed messages
  }
}

export const useTranscriptStore = create<TranscriptState>((set, get) => ({
  micStatus: "off",
  error: null,
  segments: [],
  interimSegment: null,
  speakers: {},
  pendingUtterance: "",
  flushedCount: 0,

  startMic: async () => {
    if (get().micStatus === "on" || get().micStatus === "requesting") return;
    set({ micStatus: "requesting", error: null });

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      set({
        micStatus: "error",
        error: err instanceof Error ? err.message : "Microphone access denied",
      });
      return;
    }

    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    socket = new WebSocket(`${protocol}//${location.host}/ws/transcribe`);
    socket.onopen = () => {
      try {
        mediaRecorder = new MediaRecorder(mediaStream!, {
          mimeType: "audio/webm;codecs=opus",
        });
      } catch {
        // Fallback if opus in webm isn't supported
        mediaRecorder = new MediaRecorder(mediaStream!);
      }
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0 && socket?.readyState === WebSocket.OPEN) {
          socket.send(e.data);
        }
      };
      mediaRecorder.start(250);
      set({ micStatus: "on" });
    };

    socket.onmessage = handleDeepgramMessage;

    socket.onerror = () => {
      set({ micStatus: "error", error: "WebSocket connection failed" });
    };

    socket.onclose = () => {
      const status = get().micStatus;
      if (status === "on" || status === "requesting") {
        set({ micStatus: "off" });
      }
    };
  },

  stopMic: () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    mediaRecorder = null;

    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
    }

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "CloseStream" }));
      socket.close();
    }
    socket = null;

    flushPending();
    set({ micStatus: "off", interimSegment: null });
  },

  renameSpeaker: (index, name) => {
    set((s) => ({
      speakers: {
        ...s.speakers,
        [index]: { ...s.speakers[index], name },
      },
    }));
  },

  clearTranscript: () => {
    set({
      segments: [],
      interimSegment: null,
      pendingUtterance: "",
      speakers: {},
      flushedCount: 0,
    });
    clearSafetyTimer();
    utteranceBuffer = [];
    segmentCounter = 0;
  },
}));
