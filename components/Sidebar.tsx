"use client";

import { useState } from "react";
import {
  ChevronsRight,
  ClipboardList,
  FileText,
  Home,
  Library,
  PanelLeftClose,
  Settings,
  Sparkles,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

type PanelId =
  | "toolkit"
  | "home"
  | "classroom"
  | "assignments"
  | "library"
  | "settings"
  | "school";

type NavItem = { id: PanelId | "exams"; label: string; icon: LucideIcon };

const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "classroom", label: "My Classroom", icon: Users },
  { id: "assignments", label: "Assignments", icon: ClipboardList },
  { id: "exams", label: "Exams", icon: FileText },
  { id: "library", label: "My Library", icon: Library },
];

// ---- Mock data (illustrative only; no backend) ----

const HOME_STATS = [
  { label: "Sheets graded this week", value: "48" },
  { label: "Pending reviews", value: "3" },
  { label: "Average class score", value: "72%" },
];

const HOME_ACTIVITY = [
  "Class 10-B Science · Unit Test 2 graded",
  "Ananya Verma · Q7 (b) flagged for review",
  "Rahul Sir shared \"Class 10 Maths – Unit Test 2\"",
];

const CLASSES = [
  { name: "Class 10-A · Science", students: 38, avg: "74%" },
  { name: "Class 10-B · Science", students: 36, avg: "69%" },
  { name: "Class 9-C · Science", students: 40, avg: "78%" },
];

const ASSIGNMENTS = [
  { title: "Photosynthesis worksheet", due: "Due 2 Sep", status: "12 / 38 submitted" },
  { title: "Chemical reactions – MCQ set", due: "Due 5 Sep", status: "Not started" },
  { title: "Human digestive system – diagram", due: "Graded", status: "38 / 38 graded" },
];

const LIBRARY = [
  { title: "Class 10 Science – Unit Test 2", kind: "Question paper · 4 pages" },
  { title: "Diagram rubric (5 marks)", kind: "Rubric" },
  { title: "Class 10 Science – Half yearly", kind: "Question paper · 6 pages" },
  { title: "Long-answer rubric (8 marks)", kind: "Rubric" },
];

const SETTINGS = [
  { label: "Auto-map answers to questions", on: true },
  { label: "Strict grading", on: false },
  { label: "Show AI feedback to students", on: true },
  { label: "Weekly email digest", on: true },
];

const AI_ACTIONS = [
  { label: "Generate a question paper", hint: "From syllabus & difficulty" },
  { label: "Summarise class performance", hint: "Strengths, gaps, next steps" },
  { label: "Draft feedback for parents", hint: "Per student, in simple language" },
  { label: "Create a grading rubric", hint: "For any subjective question" },
];

const SCHOOL = {
  name: "Delhi Public School",
  city: "Bokaro Steel City",
  board: "CBSE · Affiliation 330xxxx",
  students: "1,240 students · 68 teachers",
  plan: "VedaAI School plan · renews Mar 2027",
};

const PANEL_TITLES: Record<PanelId, string> = {
  toolkit: "AI Teacher's Toolkit",
  home: "Home",
  classroom: "My Classroom",
  assignments: "Assignments",
  library: "My Library",
  settings: "Settings",
  school: "School",
};

// ---- Panel content ----

function ListRow({ title, sub, right }: { title: string; sub?: string; right?: string }) {
  return (
    <button
      type="button"
      className="flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-page-bg"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm text-ink">{title}</span>
        {sub ? <span className="block text-xs text-ink-soft">{sub}</span> : null}
      </span>
      {right ? (
        <span className="shrink-0 font-mono text-xs text-ink-soft tabular-nums">{right}</span>
      ) : null}
    </button>
  );
}

function PanelBody({ id }: { id: PanelId }) {
  switch (id) {
    case "toolkit":
      return (
        <div className="p-2">
          {AI_ACTIONS.map((a) => (
            <button
              key={a.label}
              type="button"
              className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-page-bg"
            >
              <Sparkles size={14} className="mt-0.5 shrink-0 text-accent" />
              <span className="min-w-0">
                <span className="block text-sm text-ink">{a.label}</span>
                <span className="block text-xs text-ink-soft">{a.hint}</span>
              </span>
            </button>
          ))}
        </div>
      );
    case "home":
      return (
        <div className="p-3">
          <p className="text-sm font-medium">Good morning, Divya 👋</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {HOME_STATS.map((s) => (
              <div key={s.label} className="rounded-lg border border-line p-2.5">
                <p className="text-lg font-semibold tabular-nums">{s.value}</p>
                <p className="text-[11px] leading-snug text-ink-soft">{s.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[10px] font-bold uppercase tracking-wide text-ink-soft">
            Recent activity
          </p>
          <ul className="mt-1">
            {HOME_ACTIVITY.map((a) => (
              <li key={a} className="border-b border-line py-2 text-sm last:border-b-0">
                {a}
              </li>
            ))}
          </ul>
        </div>
      );
    case "classroom":
      return (
        <div className="p-2">
          {CLASSES.map((c) => (
            <ListRow
              key={c.name}
              title={c.name}
              sub={`${c.students} students`}
              right={`avg ${c.avg}`}
            />
          ))}
        </div>
      );
    case "assignments":
      return (
        <div className="p-2">
          {ASSIGNMENTS.map((a) => (
            <ListRow key={a.title} title={a.title} sub={a.status} right={a.due} />
          ))}
        </div>
      );
    case "library":
      return (
        <div className="p-2">
          {LIBRARY.map((l) => (
            <ListRow key={l.title} title={l.title} sub={l.kind} />
          ))}
        </div>
      );
    case "settings":
      return (
        <div className="p-2">
          {SETTINGS.map((s) => (
            <div key={s.label} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="text-sm">{s.label}</span>
              <span
                role="switch"
                aria-checked={s.on}
                aria-label={s.label}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                  s.on ? "bg-accent" : "bg-line"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left] ${
                    s.on ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </span>
            </div>
          ))}
          <p className="px-3 pt-2 text-xs text-ink-soft">
            Preferences are illustrative and not saved.
          </p>
        </div>
      );
    case "school":
      return (
        <div className="p-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-page-bg text-2xl"
            >
              🏫
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{SCHOOL.name}</p>
              <p className="truncate text-xs text-ink-soft">{SCHOOL.city}</p>
            </div>
          </div>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="text-ink-soft">{SCHOOL.board}</div>
            <div className="text-ink-soft">{SCHOOL.students}</div>
            <div className="text-ink-soft">{SCHOOL.plan}</div>
          </dl>
          <button
            type="button"
            className="mt-3 w-full rounded-full border border-line px-3 py-1.5 text-sm font-medium hover:bg-page-bg"
          >
            Switch school
          </button>
        </div>
      );
  }
}

// ---- Sidebar ----

type Props = {
  /** Icon-only rail (used on the processing and results screens). */
  collapsed: boolean;
  onToggle: () => void;
};

export default function Sidebar({ collapsed, onToggle }: Props) {
  const [openPanel, setOpenPanel] = useState<PanelId | null>(null);

  function toggle(id: PanelId) {
    setOpenPanel((current) => (current === id ? null : id));
  }

  const navButtonClass = (active: boolean) =>
    `flex items-center gap-3 rounded-lg border text-[13px] font-medium transition-colors ${
      collapsed ? "justify-center px-0 py-2" : "px-3 py-2"
    } ${
      active
        ? "border-line bg-page-bg text-ink"
        : "border-transparent text-ink-soft hover:bg-page-bg hover:text-ink"
    }`;

  return (
    <aside
      className={`relative hidden shrink-0 flex-col border-r border-line bg-panel transition-[width] lg:flex ${
        collapsed ? "w-14" : "w-56"
      }`}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpenPanel(null);
      }}
    >
      {/* Logo + collapse control */}
      <div
        className={`flex h-14 items-center ${collapsed ? "justify-center" : "justify-between px-4"}`}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-sm font-bold text-white">
            V
          </span>
          {!collapsed ? (
            <span className="text-[15px] font-semibold tracking-tight">VedaAI</span>
          ) : null}
        </div>
        {!collapsed ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Collapse sidebar"
            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-soft hover:bg-page-bg hover:text-ink"
          >
            <PanelLeftClose size={15} />
          </button>
        ) : null}
      </div>

      {/* Toolkit CTA: black pill with orange outline */}
      <div className={collapsed ? "flex justify-center pb-3 pt-1" : "px-4 pb-4 pt-1"}>
        <button
          type="button"
          aria-label="AI Teacher's Toolkit"
          aria-expanded={openPanel === "toolkit"}
          onClick={() => toggle("toolkit")}
          className={`flex items-center justify-center gap-2 rounded-full bg-ink text-[13px] font-medium text-white shadow-[0_0_0_1.5px_var(--accent)] transition-colors hover:bg-black ${
            collapsed ? "h-8 w-8" : "w-full px-3 py-2"
          }`}
        >
          <Sparkles size={14} className="text-accent" />
          {!collapsed ? <span>AI Teacher&apos;s Toolkit</span> : null}
        </button>
      </div>

      {/* Nav ("Exams" is the active page; others open a mock panel) */}
      <nav aria-label="Main" className={`flex flex-col gap-0.5 ${collapsed ? "px-2" : "px-3"}`}>
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isExams = id === "exams";
          const active = isExams ? openPanel === null : openPanel === id;
          return (
            <button
              key={id}
              type="button"
              title={label}
              aria-current={isExams ? "page" : undefined}
              aria-expanded={isExams ? undefined : openPanel === id}
              onClick={() => (isExams ? setOpenPanel(null) : toggle(id))}
              className={navButtonClass(active)}
            >
              <Icon size={16} className="shrink-0" />
              {!collapsed ? <span>{label}</span> : null}
            </button>
          );
        })}
      </nav>

      {/* Settings + school card */}
      <div className={`mt-auto ${collapsed ? "px-2 pb-3" : "px-3 pb-4"}`}>
        <button
          type="button"
          title="Settings"
          aria-expanded={openPanel === "settings"}
          onClick={() => toggle("settings")}
          className={`mb-2 w-full ${navButtonClass(openPanel === "settings")}`}
        >
          <Settings size={16} className="shrink-0" />
          {!collapsed ? <span>Settings</span> : null}
        </button>

        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              title="Delhi Public School"
              aria-expanded={openPanel === "school"}
              onClick={() => toggle("school")}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-page-bg text-base hover:bg-panel"
            >
              <span aria-hidden="true">🏫</span>
            </button>
            <button
              type="button"
              onClick={onToggle}
              aria-label="Expand sidebar"
              className="flex h-7 w-7 items-center justify-center rounded-md text-ink-soft hover:bg-page-bg hover:text-ink"
            >
              <ChevronsRight size={15} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            aria-expanded={openPanel === "school"}
            onClick={() => toggle("school")}
            className={`flex w-full items-center gap-3 rounded-xl border border-line p-3 text-left transition-colors hover:bg-page-bg ${
              openPanel === "school" ? "bg-page-bg" : ""
            }`}
          >
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-page-bg text-lg"
            >
              🏫
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold">Delhi Public School</span>
              <span className="block truncate text-xs text-ink-soft">Bokaro Steel City</span>
            </span>
          </button>
        )}
      </div>

      {/* Flyout panel with mock content, anchored to the sidebar's right edge */}
      {openPanel ? (
        <>
          <button
            type="button"
            aria-label="Close panel"
            tabIndex={-1}
            onClick={() => setOpenPanel(null)}
            className="fixed inset-0 z-40 cursor-default bg-transparent"
          />
          <div
            role="dialog"
            aria-label={PANEL_TITLES[openPanel]}
            className="absolute left-full top-3 z-50 ml-2 w-80 max-w-[min(20rem,calc(100vw-5rem))] overflow-hidden rounded-xl border border-line bg-panel shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
              <p className="text-sm font-semibold">{PANEL_TITLES[openPanel]}</p>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpenPanel(null)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-ink-soft hover:bg-page-bg hover:text-ink"
              >
                <X size={14} />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              <PanelBody id={openPanel} />
            </div>
          </div>
        </>
      ) : null}
    </aside>
  );
}
