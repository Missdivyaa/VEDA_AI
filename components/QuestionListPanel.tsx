"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { GradeResult, MappedItem } from "@/lib/types";

type Props = {
  items: MappedItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

/** "11 (a)", "3(ii)", "Q4 b" → sub-part. "1", "2.", "Q3" → top-level. */
export function isSubPart(number: string): boolean {
  const stripped = number.replace(/^\s*q(?:uestion)?\.?\s*/i, "");
  return /[a-z]/i.test(stripped);
}

/** Label shown for a sub-part: "11 (a)" → "a.", "3(ii)" → "ii." */
export function subPartLabel(number: string): string {
  const match = number.match(/([a-z]+)[)\].]*\s*$/i);
  return `${(match?.[1] ?? number).toLowerCase()}.`;
}

/**
 * Running top-level numbers, precomputed once per render. Sub-parts get null
 * and do NOT advance the counter.
 */
function computeBadges(items: MappedItem[]): (number | null)[] {
  const badges: (number | null)[] = [];
  let count = 0;
  for (const item of items) {
    if (isSubPart(item.question.number)) {
      badges.push(null);
    } else {
      count += 1;
      badges.push(count);
    }
  }
  return badges;
}

function formatMarks(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function scoreText(grade: GradeResult | null): string {
  if (!grade || grade.status === "unanswered") return "—";
  return `${formatMarks(grade.marksAwarded)}/${formatMarks(grade.marksTotal)}`;
}

function scoreClass(grade: GradeResult | null): string {
  if (!grade || grade.status === "unanswered") return "text-unanswered";
  const ratio = grade.marksTotal > 0 ? grade.marksAwarded / grade.marksTotal : 0;
  if (ratio >= 0.8) return "text-correct";
  if (ratio >= 0.4) return "text-partial";
  return "text-incorrect";
}

export default function QuestionListPanel({ items, selectedId, onSelect }: Props) {
  const [expandAll, setExpandAll] = useState(false);
  const badges = computeBadges(items);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-3 py-3 sm:px-4">
        <h2 className="min-w-0 truncate text-sm">
          Extracted Questions{" "}
          <span className="font-semibold">(from question paper)</span>
        </h2>
        <button
          type="button"
          onClick={() => setExpandAll((v) => !v)}
          className="shrink-0 text-xs font-medium text-accent-ink underline-offset-2 hover:underline"
        >
          {expandAll ? "Collapse All" : "Expand All"}
        </button>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto p-2">
        {items.map((item, index) => {
          const { question, answer, grade } = item;
          const badge = badges[index];
          const sub = badge === null;
          const selected = question.id === selectedId;
          const open = expandAll || selected;

          return (
            <li key={question.id} className={sub ? "pl-6 sm:pl-8" : ""}>
              <button
                type="button"
                onClick={() => onSelect(question.id)}
                aria-expanded={open}
                title={`Question ${question.number}`}
                className={`flex w-full items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                  selected
                    ? "border-accent bg-accent-soft"
                    : "border-transparent hover:bg-page-bg"
                }`}
              >
                {sub ? (
                  <span className="w-5 shrink-0 pt-0.5 text-xs font-bold text-ink-soft">
                    {subPartLabel(question.number)}
                  </span>
                ) : (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-page-bg text-[11px] font-semibold text-ink-soft">
                    {badge}
                  </span>
                )}

                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 block text-sm leading-snug text-ink">
                    {question.text || `Question ${question.number}`}
                  </span>
                  {!answer ? (
                    <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-unanswered">
                      Unanswered
                    </span>
                  ) : answer.outOfOrder ? (
                    <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-partial">
                      Answered out of order
                    </span>
                  ) : null}
                </span>

                <span className="flex shrink-0 items-center gap-1.5 pt-0.5">
                  <span
                    className={`font-mono text-xs font-semibold tabular-nums ${scoreClass(grade)}`}
                  >
                    {scoreText(grade)}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`text-ink-soft transition-transform ${open ? "rotate-180" : ""}`}
                  />
                </span>
              </button>

              {open ? (
                <div className="mb-1.5 mt-1 rounded-lg bg-accent-soft px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-accent-ink">
                    AI Feedback
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-ink">
                    {grade?.feedback ?? "Not graded yet."}
                  </p>
                  {answer?.transcript ? (
                    <div className="mt-2 border-t border-accent/15 pt-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">
                        Student&apos;s answer (transcribed)
                      </p>
                      <p className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-ink-soft">
                        {answer.transcript}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
