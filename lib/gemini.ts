// Thin wrapper around the Gemini REST API (raw fetch, no SDK).
//
// Only the three API routes under app/api/* call this. The teacher's API key
// is forwarded per-request from the browser and is never read from
// process.env or persisted anywhere.

/**
 * Free-tier Flash model. Verified on 2026-08-28 against
 * https://ai.google.dev/gemini-api/docs/models and .../pricing ("Free of charge").
 * Change this one constant if Google renames or retires the model.
 */
export const GEMINI_MODEL = "gemini-3.6-flash";

export const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Google's Gemini 3 developer guide: "For all Gemini 3 models, we strongly
 * recommend keeping the temperature parameter at its default value of 1.0"
 * — lower values are documented to cause looping / degraded output, which is
 * a real risk for long handwriting transcriptions. Structured output
 * (responseSchema) still guarantees valid JSON at this setting.
 */
export const GEMINI_TEMPERATURE = 1.0;

/** Abort a little before the route's 60s maxDuration so the user sees a clear error. */
const GEMINI_TIMEOUT_MS = 55_000;

export type GeminiSchemaType =
  | "STRING"
  | "NUMBER"
  | "INTEGER"
  | "BOOLEAN"
  | "ARRAY"
  | "OBJECT";

/** Subset of the Gemini `Schema` object accepted by `generationConfig.responseSchema`. */
export type GeminiSchema = {
  type: GeminiSchemaType;
  description?: string;
  nullable?: boolean;
  enum?: string[];
  items?: GeminiSchema;
  properties?: Record<string, GeminiSchema>;
  required?: string[];
  propertyOrdering?: string[];
};

export type GeminiImage = { base64: string; mimeType: string };

export type CallGeminiJSONArgs = {
  apiKey: string;
  systemInstruction: string;
  prompt: string;
  images?: GeminiImage[];
  schema: GeminiSchema;
  model?: string;
};

type GeminiPart = { text?: string; thought?: boolean };

type GeminiResponse = {
  candidates?: {
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string; blockReasonMessage?: string };
  error?: { code?: number; message?: string; status?: string };
};

const BLOCK_FINISH_REASONS = new Set([
  "SAFETY",
  "RECITATION",
  "BLOCKLIST",
  "PROHIBITED_CONTENT",
  "SPII",
  "IMAGE_SAFETY",
]);

function friendlyHttpError(status: number, detail: string, model: string): string {
  const d = detail.trim();
  if (status === 400 && /api key not valid/i.test(d)) {
    return "Your Gemini API key was rejected (API key not valid). Check the key and try again.";
  }
  if (status === 401 || status === 403) {
    return `Gemini refused the request (HTTP ${status}): ${d || "permission denied"}. Check that your API key is valid and enabled.`;
  }
  if (status === 404) {
    return `Gemini model "${model}" was not found (HTTP 404). Update GEMINI_MODEL in lib/gemini.ts to a current model id.`;
  }
  if (status === 429) {
    return `Gemini rate limit or free-tier quota exceeded (HTTP 429). Wait a minute and try again. ${d}`.trim();
  }
  if (status === 503) {
    return "Gemini is temporarily overloaded (HTTP 503). Please try again in a moment.";
  }
  return `Gemini API error (HTTP ${status}): ${d || "unknown error"}`;
}

/** Parse the model's text, tolerating stray markdown fences or leading prose. */
function parseModelJSON(text: string): unknown {
  const trimmed = text.trim();
  const attempts = [trimmed];
  const unfenced = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  if (unfenced !== trimmed) attempts.push(unfenced);
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) attempts.push(trimmed.slice(start, end + 1));

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try the next, more lenient variant
    }
  }
  throw new Error(
    "Gemini returned a response that is not valid JSON. Please try again.",
  );
}

/**
 * Calls `models/{model}:generateContent` with a JSON response schema and
 * returns the parsed JSON body. Throws a descriptive Error on any failure.
 */
export async function callGeminiJSON<T = unknown>({
  apiKey,
  systemInstruction,
  prompt,
  images = [],
  schema,
  model = GEMINI_MODEL,
}: CallGeminiJSONArgs): Promise<T> {
  const key = apiKey?.trim();
  if (!key) {
    throw new Error(
      "Missing Gemini API key. Enter your key on the upload screen and try again.",
    );
  }

  const url = `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

  const body = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          ...images.map((i) => ({
            inline_data: { mime_type: i.mimeType, data: i.base64 },
          })),
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: GEMINI_TEMPERATURE,
    },
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      throw new Error(
        `Gemini took longer than ${Math.round(GEMINI_TIMEOUT_MS / 1000)}s to respond. Try again with fewer pages.`,
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Could not reach the Gemini API: ${message}`);
  }

  const rawText = await res.text();

  if (!res.ok) {
    let detail = rawText;
    try {
      const parsed = JSON.parse(rawText) as GeminiResponse;
      detail = parsed?.error?.message ?? rawText;
    } catch {
      // non-JSON error body; keep raw text
    }
    throw new Error(friendlyHttpError(res.status, detail, model));
  }

  let data: GeminiResponse;
  try {
    data = JSON.parse(rawText) as GeminiResponse;
  } catch {
    throw new Error("Gemini returned an unreadable (non-JSON) response body.");
  }

  if (data.promptFeedback?.blockReason) {
    const why = data.promptFeedback.blockReasonMessage ?? data.promptFeedback.blockReason;
    throw new Error(`Gemini blocked the request (${why}).`);
  }

  const candidate = data.candidates?.[0];
  if (!candidate) {
    throw new Error("Gemini returned no candidates for this request.");
  }

  const finishReason = candidate.finishReason;
  if (finishReason && BLOCK_FINISH_REASONS.has(finishReason)) {
    throw new Error(`Gemini blocked the response (finish reason: ${finishReason}).`);
  }
  if (finishReason === "MAX_TOKENS") {
    throw new Error(
      "Gemini's response was cut off because it was too long. Try again with fewer pages.",
    );
  }

  const text = (candidate.content?.parts ?? [])
    .filter((p) => typeof p.text === "string" && !p.thought)
    .map((p) => p.text as string)
    .join("");

  if (!text.trim()) {
    throw new Error(
      `Gemini returned an empty response${finishReason ? ` (finish reason: ${finishReason})` : ""}.`,
    );
  }

  return parseModelJSON(text) as T;
}
