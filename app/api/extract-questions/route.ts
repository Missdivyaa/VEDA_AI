import { NextResponse } from "next/server";
import { callGeminiJSON, type GeminiSchema } from "@/lib/gemini";
import type { BBox, ExtractedQuestion } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type RequestBody = {
  apiKey?: string;
  images?: { base64: string; mimeType: string; page: number }[];
};

type RawQuestion = {
  number?: unknown;
  text?: unknown;
  maxMarks?: unknown;
  page?: unknown;
  bbox?: Partial<Record<keyof BBox, unknown>> | null;
};

type RawResponse = { questions?: RawQuestion[] };

export type ExtractQuestionsResponse = {
  questions: Omit<ExtractedQuestion, "id">[];
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
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          number: {
            type: "STRING",
            description: 'Exact printed numbering, e.g. "1", "11 (a)", "3(ii)".',
          },
          text: { type: "STRING", description: "The question text as printed." },
          maxMarks: {
            type: "NUMBER",
            nullable: true,
            description: "Printed mark allocation, or null if none is printed.",
          },
          page: {
            type: "INTEGER",
            description: "0-indexed page the question appears on.",
          },
          bbox: BBOX_SCHEMA,
        },
        required: ["number", "text", "maxMarks", "page", "bbox"],
        propertyOrdering: ["number", "text", "maxMarks", "page", "bbox"],
      },
    },
  },
  required: ["questions"],
};

const SYSTEM_INSTRUCTION = `You are an expert at reading exam question papers. You are given every page of a question paper as images, in printed order; the first image is page 0, the second is page 1, and so on. Extract every question exactly as printed.

Rules:
1. Preserve the EXACT printed numbering of each question (e.g. "1", "2", "11 (a)", "11 (b)", "Q3", "3(ii)"). Never renumber or normalise it.
2. Every labelled sub-part is a SEPARATE entry. "11 (a)" and "11 (b)" must be two entries — never merge them into a single "11". If a question has an introductory stem followed by labelled sub-parts, put the sub-part's own text in each entry (prefix a short version of the stem only if the sub-part is meaningless without it).
3. Skip section headers, general instructions, "attempt any N" notes, page headers/footers, and marks tables. Only extract actual questions.
4. Keep the printed order: page by page, top to bottom, left column before right column.
5. Return the question text verbatim, including MCQ options (condensed onto one line if needed).
6. "page" is the 0-indexed page the question is printed on.
7. "bbox" is a TIGHT bounding box around that question's printed text on its page: {ymin, xmin, ymax, xmax} on a 0-1000 normalized scale where (0,0) is the top-left corner of the page and (1000,1000) is the bottom-right corner.
8. "maxMarks" is the mark allocation printed for the question (e.g. "[5]", "(2 marks)", "5M"); use null when no marks are printed.
Return only valid JSON that matches the schema.`;

function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function normalizeBBox(raw: RawQuestion["bbox"]): BBox {
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

function normalizeQuestions(
  raw: RawResponse,
  pageCount: number,
): Omit<ExtractedQuestion, "id">[] {
  const list = Array.isArray(raw?.questions) ? raw.questions : [];
  const out: Omit<ExtractedQuestion, "id">[] = [];
  for (const q of list) {
    const number = String(q?.number ?? "").trim();
    const text = String(q?.text ?? "").trim();
    if (!number && !text) continue;
    const maxMarksRaw = q?.maxMarks;
    const maxMarks =
      maxMarksRaw === null || maxMarksRaw === undefined || maxMarksRaw === ""
        ? null
        : Number.isFinite(Number(maxMarksRaw)) && Number(maxMarksRaw) > 0
          ? Number(maxMarksRaw)
          : null;
    out.push({
      number: number || `Q${out.length + 1}`,
      text,
      page: clamp(Math.round(toNumber(q?.page)), 0, Math.max(0, pageCount - 1)),
      bbox: normalizeBBox(q?.bbox),
      maxMarks,
    });
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as RequestBody | null;
    const apiKey = body?.apiKey?.trim() ?? "";
    const images = Array.isArray(body?.images) ? body.images : [];

    if (!apiKey) {
      return NextResponse.json({ error: "Missing Gemini API key." }, { status: 400 });
    }
    if (images.length === 0) {
      return NextResponse.json(
        { error: "No question paper pages were provided." },
        { status: 400 },
      );
    }

    const ordered = [...images].sort((a, b) => a.page - b.page);

    const prompt = `Here are the ${ordered.length} page image(s) of the question paper, attached in order (the first image is page 0, the last is page ${ordered.length - 1}). Extract every question in printed order with its exact numbering, text, printed marks, page index and tight bounding box.`;

    const raw = await callGeminiJSON<RawResponse>({
      apiKey,
      systemInstruction: SYSTEM_INSTRUCTION,
      prompt,
      images: ordered.map((i) => ({ base64: i.base64, mimeType: i.mimeType })),
      schema: RESPONSE_SCHEMA,
    });

    const questions = normalizeQuestions(raw, ordered.length);
    if (questions.length === 0) {
      return NextResponse.json(
        {
          error:
            "No questions could be found in the uploaded question paper. Check that the correct file was uploaded and the pages are legible.",
        },
        { status: 500 },
      );
    }

    const response: ExtractQuestionsResponse = { questions };
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to extract questions.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
