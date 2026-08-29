import { Sparkles } from "lucide-react";
import type { ProcessingStage } from "@/lib/types";

const STAGE_LABELS: Partial<Record<ProcessingStage, string>> = {
  rendering: "Reading your files…",
  "extracting-questions": "Extracting questions…",
  "extracting-answers": "Extracting answers…",
  mapping: "Mapping answers to questions…",
  grading: "Grading & writing feedback…",
};

type Props = { stage: ProcessingStage };

export default function ProcessingScreen({ stage }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center"
    >
      <span aria-hidden="true" className="processing-pulse relative block h-12 w-12">
        <Sparkles
          size={40}
          strokeWidth={1.5}
          className="absolute left-0 top-1 fill-accent text-accent"
        />
        <Sparkles
          size={14}
          className="absolute -right-1 top-0 fill-accent text-accent"
        />
      </span>
      <p className="mt-5 text-base font-semibold">
        {STAGE_LABELS[stage] ?? "Working…"}
      </p>
      <p className="mt-1.5 text-sm text-ink-soft">This may take a while</p>
    </div>
  );
}
