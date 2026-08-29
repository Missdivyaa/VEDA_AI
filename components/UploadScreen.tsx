"use client";

import { useRef } from "react";
import {
  ArrowRight,
  CircleAlert,
  FileImage,
  KeyRound,
  Sparkles,
  Upload,
  X,
} from "lucide-react";

type Props = {
  questionFiles: File[];
  answerFiles: File[];
  /** Page count of the chosen files, once known (PDF pages / image count). */
  questionPageCount: number | null;
  answerPageCount: number | null;
  apiKey: string;
  error: string | null;
  onQuestionFilesChange: (files: File[]) => void;
  onAnswerFilesChange: (files: File[]) => void;
  onApiKeyChange: (key: string) => void;
  onStart: () => void;
};

const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp,image/*,.pdf";

function formatMB(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 10 ? mb.toFixed(0) : mb.toFixed(mb >= 1 ? 1 : 2);
}

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

type UploadCardProps = {
  title: string;
  files: File[];
  pageCount: number | null;
  onChange: (files: File[]) => void;
};

function UploadCard({ title, files, pageCount, onChange }: UploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const first = files[0];
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);

  let meta = `${formatMB(totalBytes)} MB`;
  if (pageCount !== null) meta += ` • ${pageCount} page${pageCount === 1 ? "" : "s"}`;
  else if (files.length > 1) meta += ` • ${files.length} files`;

  return (
    <div className="relative rounded-xl border border-dashed border-line bg-panel p-5">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const picked = Array.from(event.target.files ?? []);
          if (picked.length > 0) onChange(picked);
          event.target.value = "";
        }}
      />

      {first ? (
        <>
          <button
            type="button"
            aria-label={`Remove ${title.toLowerCase()}`}
            onClick={() => onChange([])}
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-white shadow transition-colors hover:bg-black"
          >
            <X size={12} />
          </button>
          <div className="flex items-center gap-3">
            {isPdf(first) ? (
              <span className="flex h-9 w-8 shrink-0 items-center justify-center rounded-md bg-incorrect text-[9px] font-bold uppercase tracking-wide text-white">
                PDF
              </span>
            ) : (
              <span className="flex h-9 w-8 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-ink">
                <FileImage size={16} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium" title={first.name}>
                {first.name}
              </p>
              <p className="text-xs text-ink-soft">{meta}</p>
            </div>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-1.5 rounded-lg py-2 text-center transition-colors hover:bg-page-bg"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink">
            <Upload size={15} />
          </span>
          <span className="text-sm font-medium">
            Upload <span className="font-semibold text-accent">{title}</span>
          </span>
          <span className="text-xs text-ink-soft">Max 10MB</span>
        </button>
      )}
    </div>
  );
}

export default function UploadScreen({
  questionFiles,
  answerFiles,
  questionPageCount,
  answerPageCount,
  apiKey,
  error,
  onQuestionFilesChange,
  onAnswerFilesChange,
  onApiKeyChange,
  onStart,
}: Props) {
  const canStart =
    questionFiles.length > 0 && answerFiles.length > 0 && apiKey.trim().length > 0;

  return (
    <div className="flex flex-1 items-center justify-center px-3 py-6 sm:px-6 sm:py-8">
      <div className="w-full max-w-xl">
        <h1 className="text-center text-[20px] font-semibold leading-snug sm:text-[26px] sm:leading-tight">
          Upload{" "}
          <span className="rounded-md bg-accent-soft px-1.5 text-accent box-decoration-clone">
            Question Paper &amp; Answer Sheets
          </span>
        </h1>
        <p className="mt-2 text-center text-sm text-ink-soft">
          Upload both files to get started
        </p>

        {/* Avatar with dashed orange ring + sparkles */}
        <div className="relative mx-auto mt-6 h-20 w-20">
          <div
            aria-hidden="true"
            className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-accent bg-accent-soft text-[36px]"
          >
            👩‍🏫
          </div>
          <Sparkles
            aria-hidden="true"
            size={18}
            className="sparkle-pulse absolute -right-2 -top-1 text-accent"
            style={{ animationDelay: "0s" }}
          />
          <Sparkles
            aria-hidden="true"
            size={12}
            className="sparkle-pulse absolute -left-3 top-7 text-accent"
            style={{ animationDelay: "0.7s" }}
          />
          <Sparkles
            aria-hidden="true"
            size={14}
            className="sparkle-pulse absolute -bottom-1 right-0 text-accent"
            style={{ animationDelay: "1.3s" }}
          />
        </div>

        {/* Upload cards */}
        <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UploadCard
            title="Question Paper"
            files={questionFiles}
            pageCount={questionPageCount}
            onChange={onQuestionFilesChange}
          />
          <UploadCard
            title="Answer Sheet"
            files={answerFiles}
            pageCount={answerPageCount}
            onChange={onAnswerFilesChange}
          />
        </div>

        {/* API key */}
        <div className="mt-4 rounded-xl border border-line bg-panel p-4">
          <label
            htmlFor="gemini-api-key"
            className="flex items-center gap-2 text-sm font-medium"
          >
            <KeyRound size={15} className="text-ink-soft" />
            Gemini API key
          </label>
          <input
            id="gemini-api-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="AIza…"
            value={apiKey}
            onChange={(event) => onApiKeyChange(event.target.value)}
            className="mt-2 w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none transition-colors placeholder:text-ink-soft/60 focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <p className="mt-2 text-xs leading-relaxed text-ink-soft">
            Get a free key at{" "}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-accent-ink underline-offset-2 hover:underline"
            >
              aistudio.google.com/apikey
            </a>
            . The key stays in your browser and is only forwarded to Google for
            each request — it is never stored server-side.
          </p>
        </div>

        {error ? (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-lg border border-incorrect/30 bg-incorrect-bg px-3 py-2.5 text-sm text-incorrect"
          >
            <CircleAlert size={16} className="mt-0.5 shrink-0" />
            <span className="min-w-0 break-words">{error}</span>
          </div>
        ) : null}

        {/* CTA */}
        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onStart}
            disabled={!canStart}
            className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium transition-colors ${
              canStart
                ? "bg-ink text-white hover:bg-black"
                : "cursor-not-allowed bg-unanswered-bg text-unanswered"
            }`}
          >
            Start Mapping
            <ArrowRight size={16} />
          </button>
          <p className="max-w-xs text-center text-xs text-ink-soft">
            Once both files are uploaded, you&apos;ll be able to map answers with
            questions
          </p>
        </div>
      </div>
    </div>
  );
}
