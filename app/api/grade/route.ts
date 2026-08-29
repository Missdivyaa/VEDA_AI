import { NextResponse } from "next/server";
import { callGeminiJSON, type GeminiSchema } from "@/lib/gemini";
import type { GradeResult, GradeStatus } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export type GradeItemInput = {
  questionNumber: string;
  questionText: string;
  maxMarks: number | null;
  answerTranscript: string | null;
};

type RequestBody = { apiKey?: string; items?: GradeItemInput[] };

type RawResult = {
  questionNumber?: unknown;
  status?: unknown;
  marksAwarded?: unknown;
  marksTotal?: unknown;
  feedback?: unknown;
};

type RawResponse = { results?: RawResult[]; overallSummary?: unknown };

export type GradeResponse = { results: GradeResult[]; overallSummary: string };

const DEFAULT_MAX_MARKS = 5;

const RESPONSE_SCHEMA: GeminiSchema = {
  type: "OBJECT",
  properties: {
    results: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          questionNumber: {
            type: "STRING",
            description: "Copied verbatim from the input item.",
          },
          status: {
            type: "STRING",
            enum: ["correct", "partially_correct", "incorrect", "unanswered"],
          },
          marksAwarded: { type: "NUMBER" },
          marksTotal: { type: "NUMBER" },
          feedback: {
            type: "STRING",
            description: "1-2 specific, constructive sentences for the student.",
          },
        },
        required: ["questionNumber", "status", "marksAwarded", "marksTotal", "feedback"],
        propertyOrdering: ["questionNumber", "status", "marksAwarded", "marksTotal", "feedback"],
      },
    },
    overallSummary: {
      type: "STRING",
      description: "2-4 sentences on the student's overall performance.",
    },
  },
  required: ["results", "overallSummary"],
  propertyOrdering: ["results", "overallSummary"],
};

const SYSTEM_INSTRUCTION = `You are a fair, experienced teacher grading one student's exam. You receive a JSON list of items; each item has the question number, the question text, the maximum marks (may be null), and the student's transcribed answer (null when the question was not answered).

Rules:
1. Grade each item independently and fairly, based only on the question and the student's answer. Award partial credit for partially correct answers or correct working with a wrong final result.
2. "marksTotal" is the question's maximum marks. When maxMarks is null, assume a maximum of ${DEFAULT_MAX_MARKS} marks.
3. "marksAwarded" must be between 0 and marksTotal (whole or half marks).
4. "status" is "correct" for full marks, "partially_correct" when some but not all marks are awarded, "incorrect" for an attempted answer that earns 0 marks, and "unanswered" when answerTranscript is null or empty. Unanswered items always get 0 marks.
5. "feedback" is 1-2 sentences, specific and constructive, addressed to the student: say what was right and exactly what was missing or wrong. For unanswered items, briefly state what a good answer needed to include.
6. Return exactly one result per input item, in the same order, with "questionNumber" copied verbatim.
7. "overallSummary" is 2-4 sentences on the student's overall performance: strengths, weaknesses, and the main areas to improve.
Return only valid JSON that matches the schema.`;

const VALID_STATUSES: GradeStatus[] = [
  "correct",
  "partially_correct",
  "incorrect",
  "unanswered",
];

function toNumber(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function roundHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

function normalizeResults(raw: RawResponse, items: GradeItemInput[]): GradeResult[] {
  const list = Array.isArray(raw?.results) ? raw.results : [];
  const byNumber = new Map<string, RawResult>();
  for (const r of list) {
    const n = String(r?.questionNumber ?? "").trim();
    if (n && !byNumber.has(n)) byNumber.set(n, r);
  }

  return items.map((item, index) => {
    const answered = typeof item.answerTranscript === "string" && item.answerTranscript.trim().length > 0;
    const marksTotal =
      item.maxMarks !== null && Number.isFinite(item.maxMarks) && item.maxMarks > 0
        ? item.maxMarks
        : DEFAULT_MAX_MARKS;

    // Prefer a match by question number; fall back to positional order.
    const r = byNumber.get(item.questionNumber) ?? list[index];

    if (!answered) {
      return {
        questionNumber: item.questionNumber,
        status: "unanswered",
        marksAwarded: 0,
        marksTotal,
        feedback:
          String(r?.feedback ?? "").trim() ||
          "This question was not attempted. Make sure to attempt every question, even partially, to pick up available marks.",
      };
    }

    const awarded = roundHalf(
      Math.min(marksTotal, Math.max(0, toNumber(r?.marksAwarded, 0))),
    );
    const rawStatus = String(r?.status ?? "") as GradeStatus;
    let status: GradeStatus = VALID_STATUSES.includes(rawStatus) ? rawStatus : "ungraded";
    // Keep status consistent with the marks actually awarded.
    if (status === "unanswered") status = awarded > 0 ? "partially_correct" : "incorrect";
    if (status === "ungraded") {
      status = awarded >= marksTotal ? "correct" : awarded > 0 ? "partially_correct" : "incorrect";
    }
    if (status === "correct" && awarded < marksTotal) status = "partially_correct";
    if (status === "incorrect" && awarded > 0) status = "partially_correct";

    return {
      questionNumber: item.questionNumber,
      status,
      marksAwarded: awarded,
      marksTotal,
      feedback: String(r?.feedback ?? "").trim() || "Graded by AI; no additional feedback was provided.",
    };
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as RequestBody | null;
    const apiKey = body?.apiKey?.trim() ?? "";
    const items: GradeItemInput[] = (Array.isArray(body?.items) ? body.items : []).map((it) => ({
      questionNumber: String(it?.questionNumber ?? "").trim(),
      questionText: String(it?.questionText ?? ""),
      maxMarks:
        it?.maxMarks === null || it?.maxMarks === undefined || !Number.isFinite(Number(it.maxMarks))
          ? null
          : Number(it.maxMarks),
      answerTranscript:
        typeof it?.answerTranscript === "string" && it.answerTranscript.trim()
          ? it.answerTranscript
          : null,
    }));

    if (!apiKey) {
      return NextResponse.json({ error: "Missing Gemini API key." }, { status: 400 });
    }
    if (items.length === 0) {
      return NextResponse.json({ error: "No items to grade were provided." }, { status: 400 });
    }

    const prompt = `Grade the following ${items.length} item(s). Items are in question-paper order.\n\n${JSON.stringify(items, null, 2)}`;

    const raw = await callGeminiJSON<RawResponse>({
      apiKey,
      systemInstruction: SYSTEM_INSTRUCTION,
      prompt,
      schema: RESPONSE_SCHEMA,
    });

    const response: GradeResponse = {
      results: normalizeResults(raw, items),
      overallSummary:
        String(raw?.overallSummary ?? "").trim() ||
        "Grading complete. See the per-question feedback for details.",
    };
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to grade answers.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
