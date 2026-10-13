import { z } from "zod";
export const kinds = [
  "multiple",
  "truefalse",
  "short",
  "essay",
  "matching",
  "ordering",
  "blanks",
  "selection",
  "multimatch",
  "numerical",
  "list",
  "listprompt",
  "checklist",
  "statements",
  "table",
  "diagram",
  "multipart",
] as const;
export type Kind = (typeof kinds)[number];
export const typeLabels: Record<Kind, string> = {
  multiple: "Multiple choice",
  truefalse: "True or false",
  short: "Short answer",
  essay: "Long answer",
  matching: "Matching",
  ordering: "Put in order",
  blanks: "Fill in the blanks",
  selection: "Inline choices",
  multimatch: "Multi-match",
  numerical: "Numerical",
  list: "List",
  listprompt: "List with prompts",
  checklist: "Checklist",
  statements: "Statements",
  table: "Table",
  diagram: "Diagram",
  multipart: "Multi-part",
};
export const choiceSchema = z.object({
  id: z.string().min(1),
  text: z.string().max(5000),
  correct: z.boolean(),
  locked: z.boolean().default(false),
});
export const questionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(kinds),
  text: z.string().max(30000),
  richText: z.string().max(100000).default(""),
  imageAlt: z.string().max(500).default(""),
  choiceLimit: z.number().int().min(0).max(100).default(0),
  marks: z.number().min(0).max(1000),
  choices: z.array(choiceSchema).max(100),
  answer: z.string().max(20000),
  selections: z
    .array(
      z.object({
        id: z.string(),
        choices: z.array(choiceSchema).min(2).max(20),
      }),
    )
    .max(20)
    .default([]),
  pairs: z
    .array(
      z.object({
        id: z.string(),
        left: z.string().max(5000),
        right: z.string().max(5000),
        marks: z.number().min(0).max(100).optional(),
      }),
    )
    .max(100)
    .default([]),
  table: z
    .array(
      z
        .array(
          z.object({
            id: z.string(),
            text: z.string().max(5000),
            blank: z.boolean(),
          }),
        )
        .max(12),
    )
    .max(30)
    .default([]),
  matchOptions: z.array(z.string().max(5000)).max(100).default([]),
  category: z.string().max(200).default(""),
  notes: z.string().max(10000).default(""),
  image: z.string().max(4000000).default(""),
  imageOriginal: z.string().max(4000000).default(""),
  imageRecipe: z.string().max(200000).default(""),
  pageBreak: z.boolean().default(false),
  keepTogether: z.boolean().default(true),
  group: z.string().max(200).default(""),
  tolerance: z.number().min(0).default(0),
  manual: z.boolean().default(true),
});
export type Question = z.infer<typeof questionSchema>;
export const settingsSchema = z.object({
  shuffleQuestions: z.boolean(),
  shuffleChoices: z.boolean(),
  shuffleWithinGroups: z.boolean().default(false),
  timeLimit: z.number().int().min(0).max(600),
  feedback: z.enum(["score", "answers", "none"]),
  accessCode: z.string().max(100),
  paper: z.enum(["A4", "Letter"]),
  showMarks: z.boolean(),
  header: z.string().max(200),
  footer: z.string().max(200),
  watermark: z.string().max(100),
  columns: z.number().int().min(1).max(2),
  attempts: z.number().int().min(1).max(10),
  subNumber: z.boolean().default(false),
  verticalMarks: z.boolean().default(false),
  backgroundImage: z.string().max(4000000).default(""),
  titleStyle: z.enum(["classic", "compact", "exam"]).default("classic"),
  sheetStyle: z.enum(["standard", "compact", "lined"]).default("standard"),
  questionSpacing: z.number().min(5).max(60).default(22),
});
export type Settings = z.infer<typeof settingsSchema>;
export const testSchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().max(5000),
    questions: z.array(questionSchema).max(500),
    settings: settingsSchema,
  })
  .refine(
    (doc) =>
      new Set(doc.questions.map((q) => q.id)).size === doc.questions.length,
    { message: "Question IDs must be unique." },
  );
export type TestDoc = z.infer<typeof testSchema> & {
  id: string;
  updated_at?: string;
  published?: string | null;
};
export const defaults: Settings = {
  shuffleQuestions: false,
  shuffleChoices: false,
  shuffleWithinGroups: false,
  titleStyle: "classic",
  sheetStyle: "standard",
  timeLimit: 0,
  feedback: "score",
  accessCode: "",
  paper: "A4",
  showMarks: true,
  header: "Name: ____________________   Date: ______________",
  footer: "",
  watermark: "",
  columns: 1,
  attempts: 1,
  subNumber: false,
  verticalMarks: false,
  backgroundImage: "",
  questionSpacing: 22,
};
export function newQuestion(type: Kind = "multiple"): Question {
  return {
    id: crypto.randomUUID(),
    type,
    text: "",
    richText: "",
    imageAlt: "",
    choiceLimit: 0,
    marks: 1,
    choices:
      type === "truefalse"
        ? [
            {
              id: crypto.randomUUID(),
              text: "True",
              correct: true,
              locked: false,
            },
            {
              id: crypto.randomUUID(),
              text: "False",
              correct: false,
              locked: false,
            },
          ]
        : ["", "", "", ""].map((text) => ({
            id: crypto.randomUUID(),
            text,
            correct: false,
            locked: false,
          })),
    answer: "",
    selections: [],
    pairs: [],
    table: [],
    matchOptions: [],
    category: "",
    notes: "",
    image: "",
    imageOriginal: "",
    imageRecipe: "",
    pageBreak: false,
    keepTogether: true,
    group: "",
    tolerance: 0,
    manual: type === "short",
  };
}
export function errorsFor(q: Question): string[] {
  const e: string[] = [];
  if (!q.text.trim()) e.push("Add the question text.");
  if (
    ["multiple", "truefalse", "selection", "checklist"].includes(q.type) &&
    !(q.type === "selection" && q.selections?.length)
  ) {
    if (q.choices.length < 2 || q.choices.some((c) => !c.text.trim()))
      e.push("Add at least two complete choices.");
    if (!q.choices.some((c) => c.correct)) e.push("Mark the correct answer.");
    if (
      !["multiple", "checklist"].includes(q.type) &&
      q.choices.filter((c) => c.correct).length !== 1
    )
      e.push("Choose one correct answer.");
  }
  if (
    ["matching", "multimatch", "ordering"].includes(q.type) &&
    (q.pairs.length < 2 ||
      q.pairs.some(
        (p) =>
          !p.left.trim() ||
          (["matching", "multimatch"].includes(q.type) && !p.right.trim()),
      ))
  )
    e.push("Add at least two complete items.");
  if (
    ((q.type === "short" && !q.manual) ||
      ["numerical", "blanks"].includes(q.type)) &&
    !q.answer.trim()
  )
    e.push("Add an accepted answer.");
  if (
    q.type === "numerical" &&
    q.answer.trim() &&
    !Number.isFinite(Number(q.answer))
  )
    e.push("Enter a numeric answer.");
  if (q.type === "selection") {
    if (q.text.split("___").length - 1 !== (q.selections?.length || 1))
      e.push("Provide one choice set per ___ placeholder.");
    if (
      q.selections?.some(
        (s) =>
          s.choices.filter((c) => c.correct).length !== 1 ||
          s.choices.some((c) => !c.text.trim()) ||
          new Set(s.choices.map((c) => c.id)).size !== s.choices.length,
      ) ||
      new Set((q.selections || []).map((s) => s.id)).size !==
        (q.selections || []).length
    )
      e.push("Each blank needs unique choices and exactly one correct answer.");
  }
  if (["blanks", "selection"].includes(q.type) && !q.text.includes("___"))
    e.push("Use ___ to mark the blank in the question.");
  if (
    q.type === "blanks" &&
    q.text.split("___").length - 1 !== q.answer.split("|").length
  )
    e.push("Provide one answer per blank, separated by |.");
  if (
    q.choiceLimit &&
    (q.choiceLimit < 2 ||
      q.choiceLimit < q.choices.filter((c) => c.correct || c.locked).length)
  )
    e.push(
      "Choice limit must fit at least two choices and every correct or locked choice.",
    );
  if (new Set(q.pairs.map((p) => p.id)).size !== q.pairs.length)
    e.push("Item IDs must be unique.");
  if (
    ["list", "listprompt", "statements", "multipart"].includes(q.type) &&
    (q.pairs.length < 1 || q.pairs.some((p) => !p.left.trim()))
  )
    e.push("Add at least one complete item.");
  if (
    q.type === "table" &&
    (!q.table.length ||
      !q.table.flat().some((c) => c.blank) ||
      q.table.some((row) => row.length !== q.table[0].length) ||
      q.table.flat().some((c) => !c.text.trim()))
  )
    e.push(
      "Complete the table and mark at least one cell for students to fill in.",
    );
  if (
    q.type === "statements" &&
    q.pairs.some((p) => !["True", "False"].includes(p.right))
  )
    e.push("Set each statement answer to True or False.");
  if (
    q.type === "multipart" &&
    q.marks !== q.pairs.reduce((s, p) => s + (p.marks ?? 1), 0)
  )
    e.push("Multi-part marks must equal the sum of its part marks.");
  const ids = q.choices.map((c) => c.id);
  if (new Set(ids).size !== ids.length) e.push("Choice IDs must be unique.");
  return e;
}
export type ResponseValue = string | string[] | Record<string, string>;
export type Grade = {
  earned: number;
  possible: number;
  manual: boolean;
  correct: boolean | null;
};
const normalize = (v: string) =>
  v.trim().toLocaleLowerCase().replace(/\s+/g, " ");
export function grade(q: Question, value: ResponseValue | undefined): Grade {
  const result = (correct: boolean): Grade => ({
    earned: correct ? q.marks : 0,
    possible: q.marks,
    manual: false,
    correct,
  });
  if (
    ["essay", "diagram", "list", "listprompt", "multipart"].includes(q.type) ||
    (q.type === "short" && q.manual)
  )
    return { earned: 0, possible: q.marks, manual: true, correct: null };
  if (q.type === "selection" && q.selections?.length)
    return result(
      typeof value === "object" &&
        !Array.isArray(value) &&
        value !== null &&
        q.selections.every((s) =>
          s.choices.some((c) => c.correct && c.id === value[s.id]),
        ),
    );
  if (["multiple", "truefalse", "selection", "checklist"].includes(q.type)) {
    const a = Array.isArray(value)
      ? value
      : typeof value === "string"
        ? [value]
        : [];
    const correct = q.choices.filter((c) => c.correct).map((c) => c.id);
    return result(
      a.length === correct.length &&
        a.every((id) => correct.includes(id)) &&
        new Set(a).size === a.length,
    );
  }
  if (q.type === "short")
    return result(
      typeof value === "string" &&
        q.answer.split("|").some((a) => normalize(a) === normalize(value)),
    );
  if (q.type === "numerical")
    return result(
      typeof value === "string" &&
        value.trim() !== "" &&
        Number.isFinite(Number(value)) &&
        Math.abs(Number(value) - Number(q.answer)) <= q.tolerance,
    );
  if (q.type === "blanks") {
    const a = Array.isArray(value) ? value : [];
    const answers = q.answer.split("|");
    return result(
      a.length === answers.length &&
        a.every((x, i) => normalize(x) === normalize(answers[i])),
    );
  }
  if (q.type === "ordering")
    return result(
      Array.isArray(value) &&
        value.length === q.pairs.length &&
        q.pairs.every((p, i) => p.id === value[i]),
    );
  if (q.type === "table")
    return result(
      value !== undefined &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        q.table
          .flat()
          .filter((c) => c.blank)
          .every((c) => normalize(value[c.id] || "") === normalize(c.text)),
    );
  if (
    q.type === "matching" ||
    q.type === "multimatch" ||
    q.type === "statements"
  )
    return result(
      value !== undefined &&
        !Array.isArray(value) &&
        typeof value === "object" &&
        q.pairs.every(
          (p) => normalize(value[p.id] || "") === normalize(p.right),
        ),
    );
  return result(false);
}
export type PublicQuestion = Omit<
  Question,
  | "answer"
  | "notes"
  | "choices"
  | "pairs"
  | "tolerance"
  | "manual"
  | "table"
  | "imageOriginal"
  | "imageRecipe"
  | "matchOptions"
  | "selections"
> & {
  choices: { id: string; text: string }[];
  pairs: { id: string; left: string; marks?: number }[];
  table: Question["table"];
  options: string[];
  multiple: boolean;
  selections: { id: string; choices: { id: string; text: string }[] }[];
};
export function publicQuestion(
  q: Question,
  options?: string[],
): PublicQuestion {
  const {
    answer,
    notes,
    tolerance,
    manual,
    choices,
    pairs,
    table,
    imageOriginal,
    imageRecipe,
    matchOptions,
    selections,
    ...rest
  } = q;
  return {
    ...rest,
    selections: (selections || []).map((s) => ({
      id: s.id,
      choices: s.choices.map(({ id, text }) => ({ id, text })),
    })),
    choices: choices.map(({ id, text }) => ({ id, text })),
    pairs: pairs.map(({ id, left, marks }) => ({
      id,
      left: q.type === "list" ? "" : left,
      marks,
    })),
    table: (table || []).map((row) =>
      row.map((c) => ({ ...c, text: c.blank ? "" : c.text })),
    ),
    options: ["matching", "multimatch"].includes(q.type)
      ? (options ?? [
          ...new Set(
            [...(matchOptions || []), ...pairs.map((p) => p.right)].filter(
              (x) => x.trim(),
            ),
          ),
        ])
      : [],
    multiple:
      q.type === "checklist" ||
      (q.type === "multiple" && choices.filter((c) => c.correct).length > 1),
  };
}
export function shuffle<T>(a: T[], random = Math.random): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
export function materialize(
  questions: Question[],
  settings: Settings,
): Question[] {
  let qs = structuredClone(questions);
  if (settings.shuffleQuestions || settings.shuffleWithinGroups) {
    const units: Question[][] = [];
    for (const q of qs) {
      const last = units.at(-1);
      if (q.group && last?.[0].group === q.group) last.push(q);
      else units.push([q]);
    }
    const arranged = settings.shuffleQuestions ? shuffle(units) : units;
    qs = arranged
      .map((unit) =>
        settings.shuffleWithinGroups && unit[0].group ? shuffle(unit) : unit,
      )
      .flat();
  }
  qs = qs.map((q) => {
    if (!q.choiceLimit || q.choiceLimit >= q.choices.length) return q;
    const keep = q.choices.filter((c) => c.correct || c.locked);
    const chosen = new Set(
      [
        ...keep,
        ...shuffle(q.choices.filter((c) => !c.correct && !c.locked)).slice(
          0,
          q.choiceLimit - keep.length,
        ),
      ].map((c) => c.id),
    );
    return { ...q, choices: q.choices.filter((c) => chosen.has(c.id)) };
  });
  if (settings.shuffleChoices)
    qs = qs.map((q) => {
      const movable = shuffle(q.choices.filter((c) => !c.locked));
      return {
        ...q,
        choices: q.choices.map((c) => (c.locked ? c : movable.shift()!)),
      };
    });
  return qs;
}

export function questionNumbers(
  questions: Pick<Question, "group">[],
  subNumber = false,
): string[] {
  let primary = 0,
    group = "",
    part = 0;
  return questions.map((q) => {
    if (subNumber && q.group) {
      if (group !== q.group) {
        primary++;
        part = 0;
        group = q.group;
      }
      part++;
      return `${primary}.${part}`;
    }
    group = "";
    primary++;
    return String(primary);
  });
}
