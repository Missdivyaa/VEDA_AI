"use client";

import { useState, type ReactNode } from "react";
import {
  Bell,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  CircleHelp,
  ClipboardList,
  FileText,
  KeyRound,
  LogOut,
  Menu,
  MessageSquare,
  School,
  Settings,
  Sparkles,
  User,
  type LucideIcon,
} from "lucide-react";

type Props = {
  /** Returns the user to the upload screen. */
  onBack: () => void;
};

type MenuId = "help" | "notifications" | "ai" | "profile";

// ---- Mock data (no backend; purely illustrative) ----

const HELP_LINKS: { label: string; icon: LucideIcon }[] = [
  { label: "Getting started guide", icon: BookOpen },
  { label: "How answer mapping works", icon: ClipboardList },
  { label: "Keyboard shortcuts", icon: KeyRound },
  { label: "Contact support", icon: MessageSquare },
];

const NOTIFICATIONS: { title: string; body: string; time: string; unread: boolean }[] = [
  {
    title: "Class 10-B Science graded",
    body: "12 answer sheets mapped and graded. 2 flagged for review.",
    time: "5 min ago",
    unread: true,
  },
  {
    title: "Ananya Verma needs a manual check",
    body: "Q7 (b) answer spans pages 3–4 with low confidence.",
    time: "1 hr ago",
    unread: true,
  },
  {
    title: "New question paper shared",
    body: "Rahul Sir uploaded \"Class 10 Maths – Unit Test 2\".",
    time: "Yesterday",
    unread: false,
  },
];

const AI_ACTIONS: { label: string; hint: string }[] = [
  { label: "Generate a question paper", hint: "From syllabus & difficulty" },
  { label: "Summarise class performance", hint: "Strengths, gaps, next steps" },
  { label: "Draft feedback for parents", hint: "Per student, in simple language" },
  { label: "Create a grading rubric", hint: "For any subjective question" },
];

const PROFILE = {
  name: "Divya Sharma",
  initials: "DS",
  email: "divya.sharma@dpsbokaro.edu.in",
  role: "Teacher · Class 10 Science",
  school: "Delhi Public School, Bokaro Steel City",
};

// ---- Small building blocks ----

const iconButtonClass =
  "flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-page-bg hover:text-ink";

function Popover({
  title,
  width = "w-72",
  children,
}: {
  title: string;
  width?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="menu"
      className={`absolute right-0 top-11 z-50 ${width} max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-line bg-panel text-left shadow-lg`}
    >
      <p className="border-b border-line px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
        {title}
      </p>
      {children}
    </div>
  );
}

function MenuRow({
  icon: Icon,
  children,
  onClick,
  danger,
}: {
  icon?: LucideIcon;
  children: ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors hover:bg-page-bg ${
        danger ? "text-incorrect" : "text-ink"
      }`}
    >
      {Icon ? <Icon size={15} className="shrink-0 text-ink-soft" /> : null}
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  );
}

export default function TopBar({ onBack }: Props) {
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const [notificationsRead, setNotificationsRead] = useState(false);

  const unreadCount = notificationsRead ? 0 : NOTIFICATIONS.filter((n) => n.unread).length;

  function toggle(id: MenuId) {
    setOpenMenu((current) => (current === id ? null : id));
    if (id === "notifications") setNotificationsRead(true);
  }

  function close() {
    setOpenMenu(null);
  }

  return (
    <header
      className="relative flex h-14 shrink-0 items-center justify-between border-b border-line bg-panel px-3 sm:px-5"
      onKeyDown={(event) => {
        if (event.key === "Escape") close();
      }}
    >
      {/* Click-away backdrop while a menu is open */}
      {openMenu ? (
        <button
          type="button"
          aria-label="Close menu"
          tabIndex={-1}
          onClick={close}
          className="fixed inset-0 z-40 cursor-default bg-transparent"
        />
      ) : null}

      {/* Left: back + breadcrumb ("Exams" on desktop, brand on mobile) */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to upload"
          className={iconButtonClass}
        >
          <ChevronLeft size={18} />
        </button>
        <span className="hidden items-center gap-1.5 text-sm font-medium lg:flex">
          <FileText size={14} className="text-ink-soft" />
          Exams
        </span>
        <span className="flex items-center gap-2 text-sm font-semibold lg:hidden">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ink text-[11px] font-bold text-white">
            V
          </span>
          VedaAI
        </span>
      </div>

      {/* Right: help, notifications, AI, user, mobile menu */}
      <div className="flex items-center gap-0.5 sm:gap-1">
        {/* Help */}
        <div className="relative hidden lg:block">
          <button
            type="button"
            aria-label="Help"
            aria-haspopup="menu"
            aria-expanded={openMenu === "help"}
            onClick={() => toggle("help")}
            className={`relative z-50 ${iconButtonClass} ${openMenu === "help" ? "bg-page-bg text-ink" : ""}`}
          >
            <CircleHelp size={18} />
          </button>
          {openMenu === "help" ? (
            <Popover title="Help & resources" width="w-64">
              {HELP_LINKS.map((link) => (
                <MenuRow key={link.label} icon={link.icon} onClick={close}>
                  {link.label}
                </MenuRow>
              ))}
              <p className="border-t border-line px-3.5 py-2 text-xs text-ink-soft">
                VedaAI v1.0 · Mapping engine: Gemini
              </p>
            </Popover>
          ) : null}
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            type="button"
            aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}
            aria-haspopup="menu"
            aria-expanded={openMenu === "notifications"}
            onClick={() => toggle("notifications")}
            className={`relative z-50 ${iconButtonClass} ${openMenu === "notifications" ? "bg-page-bg text-ink" : ""}`}
          >
            <Bell size={18} />
            {unreadCount > 0 ? (
              <span
                aria-hidden="true"
                className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent ring-2 ring-panel"
              />
            ) : null}
          </button>
          {openMenu === "notifications" ? (
            <Popover title="Notifications" width="w-80">
              <ul>
                {NOTIFICATIONS.map((n) => (
                  <li key={n.title} className="border-b border-line last:border-b-0">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={close}
                      className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-page-bg"
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          n.unread && !notificationsRead ? "bg-accent" : "bg-line"
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-ink">{n.title}</span>
                        <span className="block text-xs leading-relaxed text-ink-soft">{n.body}</span>
                        <span className="mt-0.5 block text-[11px] text-ink-soft">{n.time}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={close}
                className="w-full border-t border-line px-3.5 py-2 text-center text-xs font-medium text-accent-ink hover:bg-page-bg"
              >
                View all notifications
              </button>
            </Popover>
          ) : null}
        </div>

        {/* AI toolkit */}
        <div className="relative hidden lg:block">
          <button
            type="button"
            aria-label="AI Teacher's Toolkit"
            aria-haspopup="menu"
            aria-expanded={openMenu === "ai"}
            onClick={() => toggle("ai")}
            className={`relative z-50 ${iconButtonClass} ${openMenu === "ai" ? "bg-page-bg text-ink" : ""}`}
          >
            <Sparkles size={17} />
          </button>
          {openMenu === "ai" ? (
            <Popover title="AI Teacher's Toolkit" width="w-72">
              {AI_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  role="menuitem"
                  onClick={close}
                  className="flex w-full items-start gap-2.5 px-3.5 py-2 text-left transition-colors hover:bg-page-bg"
                >
                  <Sparkles size={14} className="mt-0.5 shrink-0 text-accent" />
                  <span className="min-w-0">
                    <span className="block text-sm text-ink">{action.label}</span>
                    <span className="block text-xs text-ink-soft">{action.hint}</span>
                  </span>
                </button>
              ))}
            </Popover>
          ) : null}
        </div>

        {/* Profile */}
        <div className="relative ml-1 pl-1 sm:pl-2">
          <button
            type="button"
            aria-label="Account"
            aria-haspopup="menu"
            aria-expanded={openMenu === "profile"}
            onClick={() => toggle("profile")}
            className={`relative z-50 flex items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 transition-colors hover:bg-page-bg ${
              openMenu === "profile" ? "bg-page-bg" : ""
            }`}
          >
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-ink"
            >
              {PROFILE.initials}
            </span>
            <span className="hidden text-sm font-medium lg:inline">{PROFILE.name}</span>
            <ChevronDown
              size={14}
              className={`hidden text-ink-soft transition-transform lg:block ${
                openMenu === "profile" ? "rotate-180" : ""
              }`}
            />
          </button>
          {openMenu === "profile" ? (
            <Popover title="Account" width="w-72">
              <div className="flex items-center gap-3 border-b border-line px-3.5 py-3">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-ink"
                >
                  {PROFILE.initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{PROFILE.name}</p>
                  <p className="truncate text-xs text-ink-soft">{PROFILE.email}</p>
                  <p className="truncate text-xs text-ink-soft">{PROFILE.role}</p>
                </div>
              </div>
              <MenuRow icon={User} onClick={close}>
                My profile
              </MenuRow>
              <MenuRow icon={School} onClick={close}>
                <span className="block">Switch school</span>
                <span className="block truncate text-xs text-ink-soft">{PROFILE.school}</span>
              </MenuRow>
              <MenuRow icon={Settings} onClick={close}>
                Settings
              </MenuRow>
              <div className="border-t border-line">
                <MenuRow icon={LogOut} onClick={close} danger>
                  Sign out
                </MenuRow>
              </div>
            </Popover>
          ) : null}
        </div>

        <button
          type="button"
          aria-label="Open menu"
          className={`${iconButtonClass} lg:hidden`}
        >
          <Menu size={20} />
        </button>
      </div>
    </header>
  );
}
