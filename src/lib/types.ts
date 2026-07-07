export type ExamStatus = "draft" | "live" | "ended";
export type OptionKey = "A" | "B" | "C" | "D";

export interface Exam {
  id: string;
  title: string;
  duration_minutes: number;
  status: ExamStatus;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
}

export interface Question {
  id: string;
  exam_id: string;
  position: number;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct: OptionKey;
  section: string | null;
}

// What the student's browser receives during an exam (no `correct`).
export type StudentQuestion = Omit<Question, "correct" | "exam_id">;

export interface Attempt {
  id: string;
  exam_id: string;
  student_id: string;
  started_at: string;
  deadline: string;
  submitted_at: string | null;
  status: "in_progress" | "submitted";
  answers: Record<string, OptionKey>;
  score: number | null;
  total: number | null;
  violations: number;
  auto_submitted: boolean;
}

// Violations allowed before the exam is auto-submitted.
export const MAX_VIOLATIONS = 2;
