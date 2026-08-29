"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import type { BBox, ExtractedAnswer, MappedItem, PageImage } from "@/lib/types";

type Props = {
  pages: PageImage[];
  items: MappedItem[];
  unmatchedAnswers: ExtractedAnswer[];
  selectedQuestionId: string | null;
};

const ZOOM_MIN = 50;
const ZOOM_MAX = 200;
const ZOOM_STEP = 10;

type BoxKind = "selected" | "other" | "unmatched";

type Box = { key: string; bbox: BBox; kind: BoxKind; label: string };

/** Drawing order = stacking order: unmatched under others, selected on top. */
const KIND_ORDER: Record<BoxKind, number> = { unmatched: 0, other: 1, selected: 2 };

const BOX_CLASS: Record<BoxKind, string> = {
  selected:
    "z-30 border-2 border-box-selected bg-[var(--box-selected-bg)]",
  other: "z-20 border-[1.5px] border-box-other bg-[var(--box-other-bg)]",
  unmatched:
    "z-10 border-[1.5px] border-dashed border-box-unmatched bg-[var(--box-unmatched-bg)]",
};

const TAG_CLASS: Record<BoxKind, string> = {
  selected: "bg-box-selected",
  other: "bg-box-other",
  unmatched: "bg-box-unmatched",
};

/** Page index of the first region of the selected question's answer, if any. */
function firstRegionPage(items: MappedItem[], selectedId: string | null): number | null {
  if (selectedId === null) return null;
  for (const item of items) {
    if (item.question.id === selectedId) {
      return item.answer?.regions[0]?.page ?? null;
    }
  }
  return null;
}

function boxesForPage(
  items: MappedItem[],
  unmatchedAnswers: ExtractedAnswer[],
  selectedId: string | null,
  page: number,
): Box[] {
  const boxes: Box[] = [];
  for (const item of items) {
    if (!item.answer) continue;
    const kind: BoxKind = item.question.id === selectedId ? "selected" : "other";
    item.answer.regions.forEach((region, i) => {
      if (region.page !== page) return;
      boxes.push({
        key: `${item.answer?.id}-${i}`,
        bbox: region.bbox,
        kind,
        label: `Q${item.question.number}`,
      });
    });
  }
  for (const answer of unmatchedAnswers) {
    answer.regions.forEach((region, i) => {
      if (region.page !== page) return;
      boxes.push({ key: `${answer.id}-${i}`, bbox: region.bbox, kind: "unmatched", label: "?" });
    });
  }
  return boxes.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
}

const controlButtonClass =
  "flex h-7 w-7 items-center justify-center rounded-full text-ink transition-colors hover:bg-page-bg disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent";

export default function AnswerSheetPanel({
  pages,
  items,
  unmatchedAnswers,
  selectedQuestionId,
}: Props) {
  const [zoom, setZoom] = useState(100);
  const [pageIndex, setPageIndex] = useState(0);

  // Jump to the page holding the selected answer when the selection changes.
  // This is the "adjust state during render when a prop changes" pattern —
  // intentionally NOT a useEffect + setState.
  const [prevSelectedId, setPrevSelectedId] = useState(selectedQuestionId);
  if (selectedQuestionId !== prevSelectedId) {
    setPrevSelectedId(selectedQuestionId);
    const target = firstRegionPage(items, selectedQuestionId);
    if (target !== null && target !== pageIndex) setPageIndex(target);
  }

  const pageCount = pages.length;
  const safePage = pageCount === 0 ? 0 : Math.min(Math.max(pageIndex, 0), pageCount - 1);
  const current = pages[safePage];
  const boxes = boxesForPage(items, unmatchedAnswers, selectedQuestionId, safePage);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-line bg-panel px-3 py-2.5 sm:px-4">
        <h2 className="text-sm font-semibold">Answer Sheet</h2>

        <div className="flex flex-wrap items-center gap-2">
          {/* Zoom */}
          <div className="flex items-center gap-0.5 rounded-full border border-line bg-panel p-0.5">
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))}
              disabled={zoom <= ZOOM_MIN}
              className={controlButtonClass}
            >
              <Minus size={14} />
            </button>
            <span className="w-11 text-center font-mono text-xs tabular-nums">{zoom}%</span>
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))}
              disabled={zoom >= ZOOM_MAX}
              className={controlButtonClass}
            >
              <Plus size={14} />
            </button>
          </div>

          {/* Page navigator */}
          <div className="flex items-center gap-0.5 rounded-full border border-line bg-panel p-0.5">
            <button
              type="button"
              aria-label="Previous page"
              onClick={() => setPageIndex(Math.max(0, safePage - 1))}
              disabled={safePage <= 0}
              className={controlButtonClass}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="whitespace-nowrap px-1 text-xs tabular-nums">
              Page {pageCount === 0 ? 0 : safePage + 1} of {pageCount}
            </span>
            <button
              type="button"
              aria-label="Next page"
              onClick={() => setPageIndex(Math.min(pageCount - 1, safePage + 1))}
              disabled={safePage >= pageCount - 1}
              className={controlButtonClass}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-page-bg p-2 sm:p-4 lg:p-6">
        {current ? (
          <div
            className="relative mx-auto bg-white shadow-md"
            style={{ width: `${zoom}%` }}
          >
            {/* Data-URL page render; next/image adds nothing for in-memory images. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.dataUrl}
              alt={`Answer sheet page ${safePage + 1} of ${pageCount}`}
              width={current.width}
              height={current.height}
              draggable={false}
              className="block h-auto w-full select-none"
            />

            {boxes.map((box) => {
              const { bbox } = box;
              const tagInside = bbox.ymin < 30; // no room above the page edge
              return (
                <div
                  key={box.key}
                  className={`absolute rounded-sm ${BOX_CLASS[box.kind]}`}
                  style={{
                    left: `${bbox.xmin / 10}%`,
                    top: `${bbox.ymin / 10}%`,
                    width: `${(bbox.xmax - bbox.xmin) / 10}%`,
                    height: `${(bbox.ymax - bbox.ymin) / 10}%`,
                  }}
                >
                  <span
                    className={`absolute left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-white ${TAG_CLASS[box.kind]} ${
                      tagInside ? "top-0" : "-top-5"
                    }`}
                  >
                    {box.label}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-16 text-center text-sm text-ink-soft">No answer sheet pages.</p>
        )}
      </div>
    </div>
  );
}
