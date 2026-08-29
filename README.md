# VedaAI 

A teacher uploads a **question paper** and one student's **handwritten answer
sheet** (PDF or images). The app extracts every question, transcribes the
student's answers, maps each answer to its question, highlights the **exact
region of the answer sheet** when a question is clicked, and grades everything
with per-question feedback and an overall AI summary.

> **Goal:** a teacher should quickly see *which question was answered, where
> the answer is, and which questions were left unanswered.*

---

## Contents

1. [Features](#features)
2. [How it works](#how-it-works)
3. [Tech stack](#tech-stack)
4. [Getting started](#getting-started)
5. [Using the app](#using-the-app)
6. [Deploying](#deploying)
7. [Project structure](#project-structure)
8. [Edge cases handled](#edge-cases-handled)
9. [Assumptions & limitations](#assumptions--limitations)
10. [Privacy](#privacy)
11. [Scripts](#scripts)

---

## Features

| Area | What you get |
|---|---|
| **Upload** | Question paper + answer sheet, each as a PDF or one or more images (max 10 MB per slot). Cards show file name, size and page count. |
| **Processing** | Staged progress: *Reading your files → Extracting questions → Extracting answers → Mapping → Grading*. |
| **Question extraction** | Every question in printed order, original numbering preserved, labelled sub-parts (`11 (a)`, `11 (b)`) as separate entries, printed marks captured. |
| **Answer extraction** | Faithful transcription of the handwriting, loose labels (`Q11(a)`, `11 a)`) resolved to the exact question number, one answer can span several pages/regions. |
| **Mapping** | Each question is paired with its answer; answers that match nothing are surfaced separately. |
| **Highlighting** | Click a question → the answer sheet jumps to the right page and draws a green box around the answer. Other answers on that page are blue; unmatched ones are dashed amber with a `?` tag. |
| **Grading** | Marks per question (printed marks or a default of 5), status (correct / partially correct / incorrect / unanswered), 1–2 sentence feedback, and a 2–4 sentence overall summary with a total score. |
| **Viewer** | Zoom 50–200 %, page navigator, boxes scale with zoom. |
| **Responsive** | Sidebar + two-pane layout on desktop; tab switcher (Questions / Answer Sheet) on mobile. |

## How it works

```
 PDF / images ──(pdf.js, in the browser)──► page images (PNG on screen, JPEG for the API)
        │
        ▼
 /api/extract-questions ──► Gemini ──► [{ number, text, maxMarks, page, bbox }]
        │
        ▼
 /api/extract-answers   ──► Gemini ──► [{ matchedQuestionNumber, transcript, regions[], outOfOrder }]
        │
        ▼
 client-side mapping    ──► for each question, claim the first unclaimed answer with the same number
        │
        ▼
 /api/grade             ──► Gemini ──► [{ status, marksAwarded, marksTotal, feedback }] + overallSummary
```

- **Bounding boxes** come from the model on a 0–1000 normalized scale
  (`ymin, xmin, ymax, xmax`, origin top-left) and are drawn as percentage-
  positioned overlays, so they stay aligned at any zoom level.
- **Structured output**: every Gemini call uses a JSON `responseSchema`, so
  the routes always receive well-formed JSON; they still clamp/normalize the
  values defensively before returning them.
- **State** lives entirely in React state for the session — no database, no
  server-side storage, no auth.

## Tech stack

- **Next.js 16** (App Router, TypeScript, Turbopack) · **React 19**
- **Tailwind CSS v4** — CSS-first config in `app/globals.css` (`@theme inline`)
- **pdfjs-dist 6** — client-side PDF rasterisation (worker served same-origin)
- **lucide-react** — icons
- **Google Gemini** via raw REST `fetch` — model id in one constant
  (`GEMINI_MODEL` in `lib/gemini.ts`, currently **`gemini-3.6-flash`**, free tier)
- System font stack only (no network fetch at build time)

## Getting started

**Prerequisites:** Node.js 20+ and npm.

```bash
npm install      # also copies pdf.js's worker into public/ (postinstall)
npm run dev      # http://localhost:3000
```

No `.env` file is needed. Get a free Gemini API key at
<https://aistudio.google.com/apikey> and paste it into the **Gemini API key**
field on the upload screen.

Production build and lint:

```bash
npm run build
npx eslint .
```

## Using the app

1. **Upload** the question paper and the answer sheet (PDF or images).
2. Paste your **Gemini API key** and click **Start Mapping**.
3. On the results screen:
   - Left: extracted questions with a running number badge (sub-parts are
     indented with `a.`, `b.`), the score fraction, and an **AI Feedback** box
     when expanded (plus the transcribed answer). **Expand All** opens every row.
   - Right: the answer sheet with highlight boxes. Selecting a question jumps
     to its page. Use `− NN% +` to zoom and `‹ Page X of N ›` to navigate.
   - Top: total score pill, one-line summary, and a chevron to expand the full
     summary and the "N answers didn't match a question" notice.
4. **New upload** resets everything; the **‹** back chevron returns to the
   upload screen keeping your files.

The sidebar and top-bar menus (Home, My Classroom, notifications, profile, …)
open with illustrative mock data — they are UI only.

## Deploying

### Vercel (recommended)

1. Push the repo to GitHub.
2. In Vercel, **Import** the repository. Framework preset: Next.js (auto-detected).
3. Deploy — **no environment variables are required**.

The three API routes run on the Node.js runtime with `maxDuration = 60`.
Request bodies are kept under Vercel's 4.5 MB limit by sending JPEG page images
(auto-downscaled for long answer sheets); on-screen images stay full-quality PNG.

### Anywhere else

`npm run build && npm start` serves the app on port 3000. Any host that runs
Node.js works; nothing else is required.

## Project structure

```
app/
  layout.tsx                    # root layout, metadata, global CSS
  page.tsx                      # all session state + pipeline orchestration
  globals.css                   # Tailwind v4 theme (palette, fonts, animations)
  api/
    extract-questions/route.ts  # question paper images → questions
    extract-answers/route.ts    # answer sheet images → transcribed answers + regions
    grade/route.ts              # questions + answers → marks, feedback, summary
components/
  Sidebar.tsx                   # nav rail (collapsible) with mock panels
  TopBar.tsx                    # breadcrumb, help / notifications / AI / profile menus
  UploadScreen.tsx              # upload cards, API-key field, Start Mapping
  ProcessingScreen.tsx          # staged progress
  QuestionListPanel.tsx         # question rows, numbering, feedback
  AnswerSheetPanel.tsx          # page viewer, zoom, highlight overlays
  SummaryBar.tsx                # score pill, overall summary, New upload
lib/
  types.ts                      # shared data model (BBox, PageImage, MappedItem, …)
  gemini.ts                     # GEMINI_MODEL + callGeminiJSON (raw REST, JSON schema)
  pdf.ts                        # filesToPageImages / countPages (client-side pdf.js)
scripts/
  copy-pdf-worker.js            # postinstall: node_modules → public/pdf.worker.min.mjs
public/
  pdf.worker.min.mjs            # generated by the script above
```

## Edge cases handled

- **Sub-parts** — `11 (a)` and `11 (b)` are separate questions; they are
  indented and do not advance the top-level counter.
- **Out-of-order answers** — mapping is by question number, not position; such
  answers get an "Answered out of order" label.
- **Unanswered questions** — "Unanswered" label, `—` instead of a score,
  graded 0 with status `unanswered`.
- **Answers matching no question** — listed in the summary bar and drawn as
  dashed amber `?` boxes; never force-matched.
- **Answers spanning pages** — one answer, many `regions`; boxes appear on
  every page, and selection jumps to the first one.
- **Bad input** — invalid/encrypted PDFs, undecodable images, oversized
  uploads, invalid or rate-limited API keys, blocked or truncated model
  responses all surface as a readable error above the *Start Mapping* button,
  with the uploaded files kept.
- **Cancellation** — pressing Back or New upload during processing discards
  the in-flight run's results.

## Assumptions & limitations

- Highlight accuracy depends on the model's bounding boxes; they are close but
  not pixel-exact, and very dense pages may produce overlapping boxes.
- When a question has no printed marks, a maximum of **5 marks** is assumed.
- Only one student's answer sheet is processed at a time.
- Pages are rendered at ~1600 px on the long edge; the copy sent to the API is
  JPEG and may be downscaled further for very long answer sheets to respect
  hosting request-size limits.
- Each pipeline step has a 55 s budget (Vercel functions are capped at 60 s);
  extremely long documents may time out — upload fewer pages if that happens.
- Gemini's free tier has per-minute rate limits; a 429 error just means wait a
  moment and retry.
- Nothing is persisted: refreshing the page clears the session.

## Future scope

The core assignment flow (upload → extract → map → highlight → grade) is fully
functional. To make the product feel complete, the surrounding navigation is
already built as UI with **mock data**, ready to be wired to a real backend:

| Area | What exists today (mock) | Planned functionality |
|---|---|---|
| **Home** (sidebar) | Greeting, stat tiles (sheets graded, pending reviews, average score), recent-activity list | Live dashboard fed by grading history: trends per class/subject, review queue, quick links to recent sheets |
| **My Classroom** | Three classes with student counts and averages | Class rosters, per-student profiles, bulk upload of a whole class's answer sheets and a class-level results table |
| **Assignments** | Assignment list with due dates and submission status | Create/assign work, collect submissions, auto-grade with the same pipeline, publish marks and feedback to students |
| **My Library** | Saved question papers and rubrics | Reusable question-paper bank (extracted once, mapped many times), teacher-defined rubrics that feed the grading prompt, sharing between teachers |
| **Settings** | Toggle switches (auto-map, strict grading, show feedback, digest) | Persisted preferences that actually control the pipeline: grading strictness, default marks, feedback visibility, notification cadence |
| **AI Teacher's Toolkit** (sidebar pill and top-bar ✦) | Quick actions: generate paper, summarise class, draft parent feedback, create rubric | Each action becomes a Gemini-powered workflow reusing `lib/gemini.ts`, with outputs saved to the Library |
| **Notifications** (top bar 🔔) | Three sample notifications with unread state | Real events: grading completed, low-confidence mappings to review, papers shared by colleagues; email digest |
| **Help** (top bar ?) | Static list of help topics | Searchable docs, in-app tour, support chat |
| **Profile / School card** | Name, email, role, school details, "Switch school" | Authentication, multi-school accounts, role-based access (teacher / HOD / principal) |

Other natural next steps for the core flow:

- **Batch mode** — grade a whole class in one go and export a marks sheet (CSV/Excel).
- **Teacher overrides** — edit a mapping, redraw a highlight box, or adjust marks and feedback before publishing; overrides feed back as examples to improve prompts.
- **Confidence scores** — surface the model's confidence per mapping so low-confidence answers are queued for review.
- **Persistence** — optional database so sessions survive refresh and history accumulates (the current design is intentionally in-memory per the assignment scope).
- **Rubric-aware grading** — attach a marking scheme to each question so marks follow the school's rubric rather than the model's judgement alone.

## Privacy

- The API key is typed in the browser, kept in React state, and forwarded with
  each request to the app's own API routes, which call
  `generativelanguage.googleapis.com` directly. It is never read from
  `process.env`, logged, or stored.
- Uploaded files never leave the browser except as page images inside those
  same requests. There is no database, analytics, or server-side logging of
  file contents.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Production build (type-checks too) |
| `npm start` | Serve the production build |
| `npm run lint` / `npx eslint .` | Lint (zero errors, zero warnings) |
| `npm run postinstall` | Copy the pdf.js worker into `public/` (runs automatically) |
