import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export interface TranscriptMessage {
  role: "user" | "assistant";
  content: string;
}

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

const SYSTEM_PROMPT = `You are a distillation layer between a human user and a VISUAL MOCKUP generator that builds dummy React + Tailwind prototypes.

Your job: convert the user's raw input into a single, focused UI instruction. Everything you output must describe WHAT TO SHOW ON SCREEN — never how to make it "really work."

Rules:
- Output a single instruction describing the VISUAL change to make
- Reframe any "real" feature as its visual representation:
  - "integrate AI image generation" → "Add a placeholder image area labeled 'AI-generated preview' with a hardcoded sample image"
  - "add user authentication" → "Add a login form UI with email/password fields and a Sign In button"
  - "connect to Stripe" → "Add a checkout form with card number, expiry, and CVC fields showing dummy data"
  - "add a chatbot" → "Add a chat panel with hardcoded sample messages between a user and assistant"
- Reference existing files by name when the change applies to them
- Strip conversational filler, questions, off-topic remarks
- ALL data must be hardcoded — never mention APIs, fetch, databases, or real integrations
- Keep output under 200 words, plain text, no markdown formatting
- Bug reports and fix requests ARE actionable — reframe them as fix instructions:
  - "it's not rendering" → "Fix rendering issues in the prototype so the UI displays correctly"
  - "there's a bug" → "Debug and fix the current prototype code"
  - "the screen is blank" → "The prototype shows a blank screen. Fix the code so it renders properly"
  - "it's broken" → "The prototype is broken. Review and fix the code"
- Only greetings, acknowledgments, and off-topic remarks are NOT actionable
- If the user message contains NO actionable UI request (e.g. "lol", "nice", "hmm ok", "thanks"), output exactly: NO_ACTION

You will receive:
- The user's latest message
- Recent transcript for context
- A list of existing files in the prototype`;

function readApiKey(): string | null {
  return process.env.GOOGLE_API_KEY ?? null;
}

export async function distill(
  message: string,
  transcript: TranscriptMessage[],
  fileList: string[],
): Promise<string> {
  const apiKey = readApiKey();
  if (!apiKey) return message;

  const transcriptText = transcript.length > 0
    ? `\n\nRecent transcript:\n${transcript.map((m) => `${m.role}: ${m.content}`).join("\n")}`
    : "";

  const filesText = fileList.length > 0
    ? `\n\nExisting files:\n${fileList.join("\n")}`
    : "";

  const userPrompt = `User message: "${message}"${transcriptText}${filesText}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.2 },
        }),
      },
    );

    if (!res.ok) {
      console.warn(`Distill API error ${res.status}, falling back to raw message`);
      return message;
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) return message;

    return text;
  } catch (err) {
    console.warn("Distill failed, falling back to raw message:", err);
    return message;
  }
}

// --- Idea extraction for Riff mode ---

const IDEAS_SYSTEM_PROMPT = `You are analyzing a conversation between people brainstorming a VISUAL MOCKUP prototype.

Extract discrete UI ideas — things the user would SEE on screen. We are building a DUMMY website with hardcoded data, not a real product.

Rules:
- Each idea = a specific VISIBLE UI element or layout change
- Output JSON array: [{ "title": string, "description": string, "confidence": number }]
- title: 2-6 words, imperative, describing what appears visually ("Add product card grid", "Show checkout form")
- description: 1-2 sentences of what the UI looks like. All data is fake/hardcoded. Never mention APIs, backends, or real integrations.
- Reframe functional ideas as their visual representation:
  - "AI generates designs" → "Show a grid of sample design thumbnails with an 'AI Generated' badge"
  - "users can sign up" → "Add a signup form with name, email, and password fields"
  - "payment processing" → "Show a checkout page with a fake credit card form"
- confidence: 0.0-1.0 (skip < 0.3 as off-topic chatter)
- Do NOT duplicate ideas already in existingSuggestions
- If an existing suggestion should be refined, return it with updated description and same title
- Max 5 ideas per call
- No visual ideas → return []`;

interface ExistingSuggestion {
  title: string;
  description: string;
}

interface ExtractedIdea {
  title: string;
  description: string;
  confidence: number;
}

export async function distillIdeas(
  transcript: string,
  existingSuggestions: ExistingSuggestion[],
): Promise<ExtractedIdea[]> {
  const apiKey = readApiKey();
  if (!apiKey) return [];

  const existingText = existingSuggestions.length > 0
    ? `\n\nExisting suggestions (do not duplicate):\n${existingSuggestions.map(s => `- ${s.title}: ${s.description}`).join("\n")}`
    : "";

  const userPrompt = `Conversation transcript:\n"${transcript}"${existingText}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: IDEAS_SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!res.ok) {
      console.warn(`distillIdeas API error ${res.status}`);
      return [];
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) return [];

    const parsed = JSON.parse(text) as ExtractedIdea[];
    // Filter low-confidence results
    return parsed.filter(idea => idea.confidence >= 0.3);
  } catch (err) {
    console.warn("distillIdeas failed:", err);
    return [];
  }
}
