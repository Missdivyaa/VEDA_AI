"use client";

import { useState } from "react";
import { ChevronDown, CircleAlert } from "lucide-react";

type Props = {
  totalAwarded: number;
  totalMarks: number;
  overallSummary: string;
  unmatchedCount: number;
  onNewUpload: () => void;
};

function formatMarks(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export default function SummaryBar({
  totalAwarded,
  totalMarks,
  overallSummary,
  unmatchedCount,
  onNewUpload,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const pct = totalMarks > 0 ? Math.round((totalAwarded / totalMarks) * 100) : 0;

  return (
    <div className="shrink-0 border-b border-line bg-panel px-3 py-2.5 sm:px-5">
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold tabular-nums text-white sm:px-3 sm:text-sm">
          {formatMarks(totalAwarded)}/{formatMarks(totalMarks)} · {pct}%
        </span>

        <p
          className="hidden min-w-0 flex-1 truncate text-sm text-ink sm:block"
          title={overallSummary}
        >
          {overallSummary}
        </p>
        <span className="flex-1 sm:hidden" />

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse summary" : "Expand summary"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-page-bg hover:text-ink"
        >
          <ChevronDown
            size={18}
            className={`transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>

        <button
          type="button"
          onClick={onNewUpload}
          className="shrink-0 whitespace-nowrap rounded-full border border-line bg-panel px-3 py-1.5 text-xs font-medium transition-colors hover:bg-page-bg sm:px-3.5 sm:text-sm"
        >
          New upload
        </button>
      </div>

      {expanded ? (
        <div className="mt-2.5 rounded-lg border border-line bg-page-bg px-3.5 py-3 text-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-accent-ink">
            Overall AI summary
          </p>
          <p className="mt-1 leading-relaxed text-ink">{overallSummary}</p>
          {unmatchedCount > 0 ? (
            <p className="mt-2.5 flex items-start gap-1.5 text-partial">
              <CircleAlert size={15} className="mt-0.5 shrink-0" />
              <span>
                {unmatchedCount} answer{unmatchedCount === 1 ? "" : "s"} didn&apos;t
                match a question — shown on the answer sheet with a dashed amber
                &ldquo;?&rdquo; box.
              </span>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
