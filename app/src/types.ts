import type {
  Grade,
  PublicQuestion,
  Question,
  ResponseValue,
  TestDoc,
} from "./domain";
export type User = { name: string; email: string; id: string };
export type Test = TestDoc & { revision: number };
export type TestSummary = {
  id: string;
  title: string;
  description: string;
  count: number;
  published: string | null;
  updated_at: string;
};
export type Report = {
  questions: Question[];
  warnings: string[];
  errors: string[];
  title?: string;
  document?: Pick<TestDoc, "description" | "settings">;
  csv?: { headers: string[]; rows: string[][] };
};
export type AttemptView = {
  id: string;
  title: string;
  name: string;
  questions: PublicQuestion[];
  responses: Record<string, ResponseValue>;
  deadline: string | null;
  status: string;
  serverNow: number;
  result: {
    score: number | null;
    possible: number;
    pending: boolean;
    answers:
      { id: string; answer: string; feedback: string; grade: Grade }[] | null;
  } | null;
};
export type ResultAttempt = {
  id: string;
  name: string;
  student_id: string;
  questions: Question[];
  responses: Record<string, ResponseValue>;
  status: string;
  grades: Record<string, Grade>;
  overrides: Record<string, { earned: number; feedback: string }>;
  started: string;
};
export type ResultSet = { title: string; attempts: ResultAttempt[] };
