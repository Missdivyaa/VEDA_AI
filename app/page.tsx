"use client";

import { useRef, useState, type ReactNode } from "react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import UploadScreen from "@/components/UploadScreen";
import ProcessingScreen from "@/components/ProcessingScreen";
import QuestionListPanel from "@/components/QuestionListPanel";
import AnswerSheetPanel from "@/components/AnswerSheetPanel";
import SummaryBar from "@/components/SummaryBar";
import { countPages, filesToPageImages } from "@/lib/pdf";
import type {
  ExtractedAnswer,
  ExtractedQuestion,
  GradeResult,
  MappedItem,
  PageImage,
  ProcessingStage,
  SessionResult,
} from "@/lib/types";

// ---- API route contracts (routes return the lib/types shapes minus `id`) ----

type ExtractQuestionsResponse = { questions: Omit<ExtractedQuestion, "id">[] };
type ExtractAnswersResponse = { answers: Omit<ExtractedAnswer, "id">[] };
type GradeItemInput = {
  questionNumber: string;
  questionText: string;
  maxMarks: number | null;
  answerTranscript: string | null;
};
type GradeResponse = { results: GradeResult[]; overallSummary: string };

type MobileTab = "questions" | "answers";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// ---- Pure helpers (module scope, no React state involved) ----

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Network error while calling ${url}: ${message}`);
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const serverMessage = (data as { error?: unknown } | null)?.error;
    if (typeof serverMessage === "string" && serverMessage) throw new Error(serverMessage);
    if (res.status === 413) {
      throw new Error(
        "The uploaded pages are too large to send in one request (over the 4.5 MB limit). Try fewer pages or lower-resolution scans.",
      );
    }
    throw new Error(`Request to ${url} failed (HTTP ${res.status}).`);
  }
  if (data === null) throw new Error(`Empty response from ${url}.`);
  return data as T;
}

function toApiImages(pages: PageImage[]) {
  return pages.map((p) => ({ base64: p.base64, mimeType: p.mimeType, page: p.page }));
}

/**
 * For each question (in paper order) claim the first not-yet-claimed answer
 * whose matchedQuestionNumber equals the question number exactly. Everything
 * left over — unclaimed, null-matched, or matched to an unknown number — is
 * reported as unmatched.
 */
function mapAnswersToQuestions(
  questions: ExtractedQuestion[],
  answers: ExtractedAnswer[],
): { mapped: MappedItem[]; unmatchedAnswers: ExtractedAnswer[] } {
  const claimed = new Set<string>();
  const mapped: MappedItem[] = [];

  for (const question of questions) {
    let answer: ExtractedAnswer | null = null;
    for (const candidate of answers) {
      if (!claimed.has(candidate.id) && candidate.matchedQuestionNumber === question.number) {
        answer = candidate;
        break;
      }
    }
    if (answer) claimed.add(answer.id);
    mapped.push({ question, answer, grade: null });
  }

  const unmatchedAnswers = answers.filter((a) => !claimed.has(a.id));
  return { mapped, unmatchedAnswers };
}

/** Join grade results back onto mapped items by questionNumber (positional fallback). */
function joinGrades(mapped: MappedItem[], results: GradeResult[]): MappedItem[] {
  const queues = new Map<string, GradeResult[]>();
  for (const r of results) {
    const queue = queues.get(r.questionNumber);
    if (queue) queue.push(r);
    else queues.set(r.questionNumber, [r]);
  }
  return mapped.map((item, index) => ({
    ...item,
    grade: queues.get(item.question.number)?.shift() ?? results[index] ?? null,
  }));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-ink text-white" : "bg-page-bg text-ink-soft hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

// ---- Page ----

export default function Home() {
  const [questionFiles, setQuestionFiles] = useState<File[]>([]);
  const [answerFiles, setAnswerFiles] = useState<File[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [stage, setStage] = useState<ProcessingStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("questions");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [questionPageCount, setQuestionPageCount] = useState<number | null>(null);
  const [answerPageCount, setAnswerPageCount] = useState<number | null>(null);

  // Lets "Back" / "New upload" cancel an in-flight pipeline: late results are ignored.
  const runIdRef = useRef(0);

  const canStart =
    questionFiles.length > 0 && answerFiles.length > 0 && apiKey.trim().length > 0;

  function acceptFiles(
    files: File[],
    apply: (files: File[]) => void,
    applyPageCount: (count: number | null) => void,
  ) {
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    if (totalBytes > MAX_UPLOAD_BYTES) {
      const what =
        files.length === 1 ? `"${files[0].name}" is` : `Those ${files.length} files total`;
      setError(`${what} ${(totalBytes / (1024 * 1024)).toFixed(1)} MB — the limit is 10 MB per upload.`);
      return;
    }
    setError(null);
    apply(files);
    applyPageCount(null);
    if (files.length > 0) {
      countPages(files)
        .then((count) => applyPageCount(count))
        .catch(() => applyPageCount(null)); // count is cosmetic; errors surface on Start
    }
  }

  async function handleStart() {
    if (!canStart) return;

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    const isStale = () => runIdRef.current !== runId;

    setError(null);
    setResult(null);
    setSelectedQuestionId(null);
    setMobileTab("questions");
    setSidebarCollapsed(true);

    try {
      setStage("rendering");
      const questionPages = await filesToPageImages(questionFiles);
      const answerPages = await filesToPageImages(answerFiles);
      if (isStale()) return;

      setStage("extracting-questions");
      const questionRes = await postJSON<ExtractQuestionsResponse>("/api/extract-questions", {
        apiKey,
        images: toApiImages(questionPages),
      });
      if (isStale()) return;
      const questions: ExtractedQuestion[] = questionRes.questions.map((q, i) => ({
        ...q,
        id: `q-${i}`,
      }));
      if (questions.length === 0) {
        throw new Error("No questions were found in the question paper.");
      }

      setStage("extracting-answers");
      const answerRes = await postJSON<ExtractAnswersResponse>("/api/extract-answers", {
        apiKey,
        images: toApiImages(answerPages),
        questionNumbers: questions.map((q) => q.number),
      });
      if (isStale()) return;
      const answers: ExtractedAnswer[] = answerRes.answers.map((a, i) => ({
        ...a,
        id: `a-${i}`,
      }));

      setStage("mapping");
      const { mapped, unmatchedAnswers } = mapAnswersToQuestions(questions, answers);
      await sleep(400); // mapping is instant; let the stage label register
      if (isStale()) return;

      setStage("grading");
      const items: GradeItemInput[] = mapped.map((m) => ({
        questionNumber: m.question.number,
        questionText: m.question.text,
        maxMarks: m.question.maxMarks ?? null,
        answerTranscript: m.answer?.transcript ?? null,
      }));
      const gradeRes = await postJSON<GradeResponse>("/api/grade", { apiKey, items });
      if (isStale()) return;

      const graded = joinGrades(mapped, gradeRes.results);
      const totalAwarded = graded.reduce((sum, m) => sum + (m.grade?.marksAwarded ?? 0), 0);
      const totalMarks = graded.reduce((sum, m) => sum + (m.grade?.marksTotal ?? 0), 0);

      setResult({
        questionPages,
        answerPages,
        questions,
        answers,
        mapped: graded,
        unmatchedAnswers,
        overallSummary: gradeRes.overallSummary,
        totalAwarded,
        totalMarks,
      });
      setStage("done");
    } catch (err) {
      if (isStale()) return;
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStage("idle"); // back to the upload screen, files and key intact
      setSidebarCollapsed(false);
    }
  }

  function handleSelectQuestion(id: string) {
    setSelectedQuestionId(id);
    setMobileTab("answers"); // make the highlight visible immediately on mobile
  }

  /** Top-bar back chevron: return to the upload screen, keeping files and key. */
  function handleBack() {
    runIdRef.current += 1;
    setResult(null);
    setSelectedQuestionId(null);
    setError(null);
    setStage("idle");
    setSidebarCollapsed(false);
  }

  /** "New upload": full reset to the initial state. */
  function handleReset() {
    runIdRef.current += 1;
    setQuestionFiles([]);
    setAnswerFiles([]);
    setQuestionPageCount(null);
    setAnswerPageCount(null);
    setApiKey("");
    setStage("idle");
    setError(null);
    setResult(null);
    setSelectedQuestionId(null);
    setMobileTab("questions");
    setSidebarCollapsed(false);
  }

  const processing = stage !== "idle" && stage !== "done" && stage !== "error";
  const showResults = stage === "done" && result !== null;

  return (
    <div className="flex h-dvh overflow-hidden bg-page-bg">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onBack={handleBack} />
        {/* Content sits in a white rounded card on the gray page background */}
        <main className="flex min-h-0 flex-1 flex-col p-2.5 sm:p-4">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-xl border border-line bg-panel">
          {processing ? (
            <ProcessingScreen stage={stage} />
          ) : showResults && result ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <SummaryBar
                totalAwarded={result.totalAwarded}
                totalMarks={result.totalMarks}
                overallSummary={result.overallSummary}
                unmatchedCount={result.unmatchedAnswers.length}
                onNewUpload={handleReset}
              />

              {/* Mobile-only tab switcher */}
              <div className="flex shrink-0 gap-2 border-b border-line bg-panel px-3 py-2 lg:hidden">
                <TabButton
                  active={mobileTab === "questions"}
                  onClick={() => setMobileTab("questions")}
                >
                  Questions
                </TabButton>
                <TabButton
                  active={mobileTab === "answers"}
                  onClick={() => setMobileTab("answers")}
                >
                  Answer Sheet
                </TabButton>
              </div>

              <div className="flex min-h-0 flex-1">
                <section
                  aria-label="Extracted questions"
                  className={`${
                    mobileTab === "questions" ? "flex" : "hidden"
                  } min-h-0 w-full flex-col bg-panel lg:flex lg:w-[340px] lg:max-w-[340px] lg:shrink-0 lg:border-r lg:border-line xl:w-[420px] xl:max-w-[420px]`}
                >
                  <QuestionListPanel
                    items={result.mapped}
                    selectedId={selectedQuestionId}
                    onSelect={handleSelectQuestion}
                  />
                </section>
                <section
                  aria-label="Answer sheet"
                  className={`${
                    mobileTab === "answers" ? "flex" : "hidden"
                  } min-h-0 min-w-0 flex-1 flex-col bg-panel lg:flex`}
                >
                  <AnswerSheetPanel
                    pages={result.answerPages}
                    items={result.mapped}
                    unmatchedAnswers={result.unmatchedAnswers}
                    selectedQuestionId={selectedQuestionId}
                  />
                </section>
              </div>
            </div>
          ) : (
            <UploadScreen
              questionFiles={questionFiles}
              answerFiles={answerFiles}
              questionPageCount={questionPageCount}
              answerPageCount={answerPageCount}
              apiKey={apiKey}
              error={error}
              onQuestionFilesChange={(files) =>
                acceptFiles(files, setQuestionFiles, setQuestionPageCount)
              }
              onAnswerFilesChange={(files) =>
                acceptFiles(files, setAnswerFiles, setAnswerPageCount)
              }
              onApiKeyChange={setApiKey}
              onStart={handleStart}
            />
          )}
          </div>
        </main>
      </div>
    </div>
  );
}
