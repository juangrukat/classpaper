import { newQuestion, errorsFor, type Question } from "../src/domain.js";
import type { ImportReport } from "./interchange.js";
export function readAiken(text: string): ImportReport {
  const report: ImportReport = { questions: [], errors: [], warnings: [] };
  let stem: string[] = [],
    options: { letter: string; text: string }[] = [];
  for (const [index, line] of text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .entries()) {
    if (!line.trim()) continue;
    const answer = line.match(/^ANSWER:\s*([A-Z])\s*$/i),
      choice = line.match(/^([A-Z])[.)]\s+(.+)$/);
    if (answer) {
      const q = newQuestion();
      q.text = stem.join("\n");
      q.choices = options.map((c) => ({
        id: crypto.randomUUID(),
        text: c.text,
        correct: c.letter === answer[1].toUpperCase(),
        locked: false,
      }));
      const errors = errorsFor(q);
      if (
        !options.some((c) => c.letter === answer[1].toUpperCase()) ||
        new Set(options.map((c) => c.letter)).size !== options.length ||
        errors.length
      )
        report.errors.push(
          `Line ${index + 1}: invalid answer/choices. ${errors.join(" ")}`,
        );
      else report.questions.push(q);
      stem = [];
      options = [];
    } else if (choice) options.push({ letter: choice[1], text: choice[2] });
    else if (options.length)
      report.errors.push(
        `Line ${index + 1}: expected another choice or ANSWER: letter.`,
      );
    else stem.push(line.trim());
  }
  if (stem.length || options.length)
    report.errors.push("Final question is missing ANSWER: letter.");
  return report;
}
export function exportCsv(questions: Question[]) {
  const warnings: string[] = [],
    rows: string[][] = [
      [
        "question",
        "type",
        "choice_a",
        "choice_b",
        "choice_c",
        "choice_d",
        "answer",
        "marks",
        "category",
        "tolerance",
      ],
    ];
  questions.forEach((q, i) => {
    if (
      !["multiple", "truefalse", "short", "essay", "numerical"].includes(
        q.type,
      ) ||
      q.choices.length > 4 ||
      (q.type === "short" && q.manual)
    ) {
      warnings.push(
        `Question ${i + 1}: type or choices cannot be represented; use native ZIP.`,
      );
      return;
    }
    if (q.richText || q.image || q.notes || q.group || q.choiceLimit)
      warnings.push(
        `Question ${i + 1}: formatting, images, notes, grouping and randomization are omitted.`,
      );
    const answer = ["multiple", "truefalse"].includes(q.type)
      ? q.choices
          .map((c, i) => (c.correct ? String.fromCharCode(65 + i) : ""))
          .filter(Boolean)
          .join("|")
      : q.answer;
    rows.push([
      q.text,
      q.type,
      ...Array.from({ length: 4 }, (_, i) => q.choices[i]?.text || ""),
      answer,
      String(q.marks),
      q.category,
      String(q.tolerance),
    ]);
  });
  const quote = (v: string) => {
    if (
      /^[=+@\-\t\r]/.test(v) &&
      !/^[+-]?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(v)
    ) {
      v = "'" + v;
      warnings.push(
        "A field beginning with a spreadsheet formula marker was prefixed with an apostrophe for safe opening.",
      );
    }
    return '"' + v.replace(/"/g, '""') + '"';
  };
  // Neutralize formula-like fields when opened in spreadsheet applications.
  return {
    text: "\uFEFF" + rows.map((row) => row.map(quote).join(",")).join("\r\n"),
    warnings,
  };
}
