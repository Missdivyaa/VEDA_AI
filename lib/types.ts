export type BBox = { ymin: number; xmin: number; ymax: number; xmax: number }; // 0-1000 normalized, (0,0) = top-left

export type PageImage = {
  page: number; // 0-indexed
  dataUrl: string; // base64 PNG data URL, for on-screen <img>
  base64: string; // raw base64 (no "data:" prefix), for the API calls
  mimeType: string;
  width: number;
  height: number;
};

export type ExtractedQuestion = {
  id: string;
  number: string; // exact printed numbering, e.g. "11 (a)"
  text: string;
  page: number;
  bbox: BBox;
  maxMarks?: number | null;
};

export type AnswerRegion = { page: number; bbox: BBox };

export type ExtractedAnswer = {
  id: string;
  matchedQuestionNumber: string | null; // null = no matching question
  transcript: string;
  regions: AnswerRegion[]; // can span multiple pages/regions
  outOfOrder?: boolean;
};

export type GradeStatus =
  | "correct"
  | "partially_correct"
  | "incorrect"
  | "unanswered"
  | "ungraded";

export type GradeResult = {
  questionNumber: string;
  status: GradeStatus;
  marksAwarded: number;
  marksTotal: number;
  feedback: string;
};

export type ProcessingStage =
  | "idle"
  | "rendering"
  | "extracting-questions"
  | "extracting-answers"
  | "mapping"
  | "grading"
  | "done"
  | "error";

export type MappedItem = {
  question: ExtractedQuestion;
  answer: ExtractedAnswer | null;
  grade: GradeResult | null;
};

export type SessionResult = {
  questionPages: PageImage[];
  answerPages: PageImage[];
  questions: ExtractedQuestion[];
  answers: ExtractedAnswer[];
  mapped: MappedItem[];
  unmatchedAnswers: ExtractedAnswer[];
  overallSummary: string;
  totalAwarded: number;
  totalMarks: number;
};
