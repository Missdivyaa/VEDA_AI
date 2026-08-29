import { NextResponse } from "next/server";
import { callGeminiJSON, type GeminiSchema } from "@/lib/gemini";
import type { AnswerRegion, BBox, ExtractedAnswer } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type RequestBody = {
  apiKey?: string;
  images?: { base64: string; mimeType: string; page: number }[];
  questionNumbers?: string[];
};

type RawRegion = { page?: unknown; bbox?: Partial<Record<keyof BBox, unknown>> | null };

type RawAnswer = {
  matchedQuestionNumber?: unknown;
  transcript?: unknown;
  outOfOrder?: unknown;
  regions?: RawRegion[] | null;
};

type RawResponse = { answers?: RawAnswer[] };

export type ExtractAnswersResponse = {
  answers: Omit<ExtractedAnswer, "id">[];
};

const BBOX_SCHEMA: GeminiSchema = {
  type: "OBJECT",
  description:
    "Tight bounding box on a 0-1000 normalized scale, (0,0) = top-left of the page.",
  properties: {
    ymin: { type: "INTEGER" },
    xmin: { type: "INTEGER" },
    ymax: { type: "INTEGER" },
    xmax: { type: "INTEGER" },
  },
  required: ["ymin", "xmin", "ymax", "xmax"],
  propertyOrdering: ["ymin", "xmin", "ymax", "xmax"],
};

const RESPONSE_SCHEMA: GeminiSchema = {
  type: "OBJECT",
  properties: {
    answers: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          matchedQuestionNumber: {
            type: "STRING",
            nullable: true,
            description:
              "Copied VERBATIM from the provided question-number list, or null when no confident match exists.",
          },
          transcript: {
            type: "STRING",
            description: "Faithful plain-text transcription of the handwritten answer.",
          },
          outOfOrder: {
            type: "BOOLEAN",
            description: "True when the answer is written noticeably out of the expected sequence.",
          },
          regions: {
            type: "ARRAY",
            description: "One entry per page/position where this answer is written, in reading order.",
            items: {
              type: "OBJECT",
              properties: {
                page: { type: "INTEGER", description: "0-indexed page." },
                bbox: BBOX_SCHEMA,
              },
              required: ["page", "bbox"],
              propertyOrdering: ["page", "bbox"],
            },
          },
        },
        required: ["matchedQuestionNumber", "transcript", "outOfOrder", "regions"],
        propertyOrdering: ["matchedQuestionNumber", "transcript", "outOfOrder", "regions"],
      },
    },
  },
  required: ["answers"],
};

const SYSTEM_INSTRUCTION = `You are an expert at reading handwritten student answer sheets. You are given every page of ONE student's answer sheet as images, in order; the first image is page 0, the second is page 1, and so on. You are also given the list of valid question numbers from the question paper.

Rules:
1. Find every distinct answer the student has written. Transcribe it faithfully as plain text in "transcript": keep the student's wording, working, and mistakes; do not correct, complete, or grade it. Describe diagrams, tables or graphs briefly in square brackets, e.g. "[labelled diagram of a plant cell]".
2. Students label answers loosely — "Q11(a)", "11 a)", "Ans. 11 (a)", "11.a", or "(a)" written under an "11" heading all refer to the same question. Match each label to the corresponding entry in the provided question-number list and copy that entry VERBATIM (character for character) into "matchedQuestionNumber".
3. Set "matchedQuestionNumber" to null — never guess — when the label is illegible or missing and the content cannot be confidently attributed, when the content is rough work, crossed out, or blank, or when the label does not correspond to anything in the provided list.
4. An answer may continue across several pages or be split into several places (e.g. "contd. on page 3", or a part added later at the bottom of another page). Return ONE entry for that answer with multiple "regions" (one per page/position), in reading order. Never split one answer into multiple entries.
5. "page" is the 0-indexed page of a region. "bbox" is a TIGHT bounding box around the handwritten answer region on that page, including its label line: {ymin, xmin, ymax, xmax} on a 0-1000 normalized scale where (0,0) is the top-left corner of the page and (1000,1000) is the bottom-right corner.
6. Set "outOfOrder" to true when the answer appears noticeably out of the expected sequence of the question paper (for example the answer to 4 is written before the answer to 2); otherwise false.
7. Do not invent answers for questions the student has not attempted — simply omit them.
Return only valid JSON that matches the schema.`;

function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function normalizeBBox(raw: RawRegion["bbox"]): BBox {
  const ymin = clamp(toNumber(raw?.ymin), 0, 1000);
  const xmin = clamp(toNumber(raw?.xmin), 0, 1000);
  const ymax = clamp(toNumber(raw?.ymax, 1000), 0, 1000);
  const xmax = clamp(toNumber(raw?.xmax, 1000), 0, 1000);
  return {
    ymin: Math.min(ymin, ymax),
    xmin: Math.min(xmin, xmax),
    ymax: Math.max(ymin, ymax),
    xmax: Math.max(xmin, xmax),
  };
}

function normalizeAnswers(
  raw: RawResponse,
  pageCount: number,
  questionNumbers: string[],
): Omit<ExtractedAnswer, "id">[] {
  const valid = new Set(questionNumbers);
  // Tolerate whitespace/case differences in the model's echo of a number, but
  // always emit the exact string from the question list.
  const canonical = new Map(
    questionNumbers.map((n) => [n.replace(/\s+/g, "").toLowerCase(), n] as const),
  );

  const list = Array.isArray(raw?.answers) ? raw.answers : [];
  const out: Omit<ExtractedAnswer, "id">[] = [];
  for (const a of list) {
    const transcript = String(a?.transcript ?? "").trim();
    const regions: AnswerRegion[] = (Array.isArray(a?.regions) ? a.regions : [])
      .map((r) => ({
        page: clamp(Math.round(toNumber(r?.page)), 0, Math.max(0, pageCount - 1)),
        bbox: normalizeBBox(r?.bbox),
      }))
      .filter((r) => r.bbox.ymax > r.bbox.ymin && r.bbox.xmax > r.bbox.xmin);

    if (!transcript && regions.length === 0) continue;

    let matched: string | null = null;
    const rawMatch = a?.matchedQuestionNumber;
    if (typeof rawMatch === "string" && rawMatch.trim()) {
      const trimmed = rawMatch.trim();
      if (valid.has(trimmed)) matched = trimmed;
      else matched = canonical.get(trimmed.replace(/\s+/g, "").toLowerCase()) ?? null;
    }

    out.push({
      matchedQuestionNumber: matched,
      transcript,
      regions,
      outOfOrder: a?.outOfOrder === true,
    });
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as RequestBody | null;
    const apiKey = body?.apiKey?.trim() ?? "";
    const images = Array.isArray(body?.images) ? body.images : [];
    const questionNumbers = (Array.isArray(body?.questionNumbers) ? body.questionNumbers : [])
      .map((n) => String(n))
      .filter((n) => n.trim().length > 0);

    if (!apiKey) {
      return NextResponse.json({ error: "Missing Gemini API key." }, { status: 400 });
    }
    if (images.length === 0) {
      return NextResponse.json(
        { error: "No answer sheet pages were provided." },
        { status: 400 },
      );
    }

    const ordered = [...images].sort((a, b) => a.page - b.page);

    const prompt = `Here are the ${ordered.length} page image(s) of one student's handwritten answer sheet, attached in order (the first image is page 0, the last is page ${ordered.length - 1}).

The valid question numbers from the question paper are (copy these strings verbatim into "matchedQuestionNumber"):
${JSON.stringify(questionNumbers)}

Extract and transcribe every answer, map each one to the exact question number it answers (or null), give every page/region where it is written, and flag answers written out of sequence.`;

    const raw = await callGeminiJSON<RawResponse>({
      apiKey,
      systemInstruction: SYSTEM_INSTRUCTION,
      prompt,
      images: ordered.map((i) => ({ base64: i.base64, mimeType: i.mimeType })),
      schema: RESPONSE_SCHEMA,
    });

    const response: ExtractAnswersResponse = {
      answers: normalizeAnswers(raw, ordered.length, questionNumbers),
    };
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to extract answers.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
