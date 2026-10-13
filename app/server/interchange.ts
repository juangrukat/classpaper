import { readQtiItem, readQtiPackage } from "./qti.js";
import { parser } from "gift-parser-ide";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import JSZip from "jszip";
import sanitize from "sanitize-html";
import { cleanQuestions } from "./content.js";
import {
  newQuestion,
  questionSchema,
  type Question,
  testSchema,
  defaults,
  errorsFor,
} from "../src/domain.js";
export type ImportReport = {
  questions: Question[];
  warnings: string[];
  errors: string[];
  title?: string;
  document?: { description: string; settings: typeof defaults };
  csv?: { headers: string[]; rows: string[][] };
};
const plain = (s: string) =>
  sanitize(s, { allowedTags: [], allowedAttributes: {} })
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
const safeImage = (s: string) =>
  /^data:image\/(png|jpeg|gif|webp);base64,[a-zA-Z0-9+/=\s]+$/.test(s) ? s : "";
export function readGift(text: string): ImportReport {
  const report: ImportReport = { questions: [], warnings: [], errors: [] };
  let category = "";
  for (const section of parser.parse(text)) {
    const [questions, errors] = section.result;
    if (errors?.length)
      report.errors.push(
        `Line ${section.location.start}: ${errors[0].message}`,
      );
    for (const g of questions || []) {
      if (g.type === "Category") {
        category = g.title;
        continue;
      }
      if (g.type === "Description") {
        report.warnings.push(
          "A description block was skipped; add it to the test instructions.",
        );
        continue;
      }
      const q = newQuestion();
      q.text = plain(g.stem.text);
      q.category = category;
      if (g.stem.format !== "plain" && /<[^>]+>/.test(g.stem.text))
        report.warnings.push(
          `${g.title || "Question"}: HTML was converted to plain text; check formatting and images.`,
        );
      if (g.title || g.tags?.length || g.globalFeedback)
        report.warnings.push(
          `${g.title || "Question"}: GIFT title, tags or feedback are not preserved by this release. Keep the source file.`,
        );
      if (g.type === "MC" || g.type === "Short") {
        if (
          g.choices.some(
            (c) => c.weight !== null && c.weight !== 0 && c.weight !== 100,
          )
        ) {
          report.errors.push(
            `${g.title || "Question"}: partial-credit weights are not supported yet; this question was not imported.`,
          );
          continue;
        }
        if (g.choices.some((c) => c.feedback))
          report.warnings.push(
            `${g.title || "Question"}: per-answer feedback is not preserved.`,
          );
        if (g.type === "MC") {
          q.type = g.hasEmbeddedAnswers ? "selection" : "multiple";
          q.text = q.text.replace(/_____/g, "___");
          q.choices = g.choices.map((c) => ({
            id: crypto.randomUUID(),
            text: plain(c.text.text),
            correct: c.isCorrect,
            locked: false,
          }));
        } else {
          q.type = g.hasEmbeddedAnswers ? "blanks" : "short";
          q.text = q.text.replace(/_____/g, "___");
          q.manual = false;
          q.answer = g.choices
            .filter((c) => c.isCorrect)
            .map((c) => plain(c.text.text))
            .join("|");
          if (g.hasEmbeddedAnswers && g.choices.length > 1) {
            report.errors.push(
              `${g.title || "Question"}: multiple accepted answers for an inline blank need review; not imported.`,
            );
            continue;
          }
        }
      } else if (g.type === "TF") {
        q.type = "truefalse";
        q.choices = [
          {
            id: crypto.randomUUID(),
            text: "True",
            correct: g.isTrue,
            locked: false,
          },
          {
            id: crypto.randomUUID(),
            text: "False",
            correct: !g.isTrue,
            locked: false,
          },
        ];
        if (g.correctFeedback || g.incorrectFeedback)
          report.warnings.push(
            `${g.title || "Question"}: true/false feedback is not preserved.`,
          );
      } else if (g.type === "Essay") q.type = "essay";
      else if (g.type === "Matching") {
        q.type = "matching";
        q.pairs = g.matchPairs.map((p) => ({
          id: crypto.randomUUID(),
          left: plain(p.subquestion.text),
          right: plain(p.subanswer),
        }));
      } else if (g.type === "Numerical") {
        q.type = "numerical";
        if (Array.isArray(g.choices)) {
          report.errors.push(
            "Numerical questions with multiple scoring ranges are not supported yet.",
          );
          continue;
        }
        const n = g.choices;
        if (n.type === "high-low") {
          q.answer = String(((n.numberHigh || 0) + (n.numberLow || 0)) / 2);
          q.tolerance = Math.abs((n.numberHigh || 0) - (n.numberLow || 0)) / 2;
        } else {
          q.answer = String(n.number);
          q.tolerance = n.range || 0;
        }
      }
      const problems = errorsFor(q);
      if (problems.length)
        report.errors.push(`${g.title || "Question"}: ${problems.join(" ")}`);
      else report.questions.push(q);
    }
  }
  return report;
}
const escapeGift = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/([~=#{}:])/g, "\\$1");
export function exportGift(questions: Question[]): {
  text: string;
  warnings: string[];
} {
  const blocks: string[] = [];
  const warnings: string[] = [];
  let category = "";
  for (const [i, q] of questions.entries()) {
    if (q.matchOptions?.some((x) => x.trim()))
      warnings.push(
        `Question ${i + 1}: additional unused match choices are not carried by GIFT.`,
      );
    if ((q.type === "essay" || (q.type === "short" && q.manual)) && q.answer)
      warnings.push(
        `Question ${i + 1}: the private teacher grading guide is not carried by GIFT.`,
      );
    if (q.richText)
      warnings.push(
        `Question ${i + 1}: rich text is converted to plain text in GIFT.`,
      );
    if (q.choiceLimit)
      warnings.push(
        `Question ${i + 1}: random choice limits are not carried by GIFT; all choices are exported.`,
      );
    if (q.image || q.notes || q.group || q.marks !== 1)
      warnings.push(
        `Question ${i + 1}: images, notes, grouping and custom marks are not carried by this GIFT export.`,
      );
    if (q.type === "short" && q.manual)
      warnings.push(
        `Question ${i + 1}: manual short-answer grading becomes an essay.`,
      );
    if (q.choices.some((c) => c.locked))
      warnings.push(
        `Question ${i + 1}: choice position locks are not carried by GIFT.`,
      );
    if (q.category !== category) {
      category = q.category;
      blocks.push(`$CATEGORY: ${escapeGift(category || "Default")}`);
    }
    let stem = escapeGift(q.text),
      body = "";
    if (q.type === "multiple" || q.type === "selection") {
      const correct = q.choices.filter((c) => c.correct).length;
      if (correct > 1) {
        warnings.push(
          `Question ${i + 1}: multiple-answer scoring requires a GIFT partial-credit policy; skipped. Use the native package.`,
        );
        continue;
      }
      body = q.choices
        .map((c) => `${c.correct ? "=" : "~"}${escapeGift(c.text)}`)
        .join(" ");
    } else if (q.type === "truefalse")
      body = q.choices[0].correct ? "TRUE" : "FALSE";
    else if (q.type === "essay" || (q.type === "short" && q.manual)) body = "";
    else if (q.type === "short")
      body = q.answer
        .split("|")
        .map((a) => "=" + escapeGift(a))
        .join(" ");
    else if (q.type === "numerical") body = `#${q.answer}:${q.tolerance}`;
    else if (q.type === "matching")
      body = q.pairs
        .map((p) => `=${escapeGift(p.left)} -> ${escapeGift(p.right)}`)
        .join(" ");
    else if (q.type === "blanks" && q.answer.split("|").length === 1)
      body = "=" + escapeGift(q.answer);
    else {
      warnings.push(
        `Question ${i + 1} (${q.type}): this GIFT adapter cannot represent it; skipped. Use the native package.`,
      );
      continue;
    }
    if (q.type === "selection" || q.type === "blanks") {
      const parts = stem.split("___");
      stem = parts[0] + `{${body}}` + parts.slice(1).join("___");
      blocks.push(`[plain]${stem}`);
    } else blocks.push(`[plain]${stem} {${body}}`);
  }
  return { text: blocks.join("\n\n") + "\n", warnings };
}
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
  const delimiter = text.split(/\r?\n/)[0].includes("\t") ? "\t" : ",";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === delimiter && !quoted) {
      row.push(field);
      field = "";
    } else if (c === "\n" && !quoted) {
      row.push(field.replace(/\r$/, ""));
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw new Error("Unclosed quoted CSV field.");
  row.push(field.replace(/\r$/, ""));
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}
export type CsvOptions = {
  hasHeaders?: boolean;
  mapping?: Record<string, number>;
};
export function readCsv(text: string, options?: CsvOptions): ImportReport {
  const r: ImportReport = { questions: [], warnings: [], errors: [] };
  const rows = parseCsv(text);
  if (rows.length > 501)
    throw new Error(
      "Import up to 500 questions at a time. Split this spreadsheet into smaller files.",
    );
  const originalHeaders =
    options?.hasHeaders === false
      ? (rows[0] || []).map((_, i) => `Column ${i + 1}`)
      : rows.shift() || [];
  const header = originalHeaders.map((h) => h.trim().toLowerCase());
  const index = (key: string) => options?.mapping?.[key] ?? header.indexOf(key);
  if (
    options?.mapping &&
    Object.values(options.mapping).some(
      (i) => !Number.isInteger(i) || i < -1 || i >= header.length,
    )
  )
    throw new Error("Select a valid spreadsheet column.");
  if (index("question") < 0)
    return { ...r, csv: { headers: originalHeaders, rows: rows.slice(0, 3) } };
  for (const [i, row] of rows.entries()) {
    const get = (key: string) => row[index(key)] || "";
    const q = newQuestion();
    q.text = get("question");
    q.category = get("category");
    q.marks = get("marks") ? Number(get("marks")) : 1;
    const rawType = get("type")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const aliases: Record<string, string> = {
      multiplechoice: "multiple",
      multichoice: "multiple",
      singlechoice: "multiple",
      multipleresponse: "multiple",
      trueorfalse: "truefalse",
      tf: "truefalse",
      shortanswer: "short",
      longanswer: "essay",
      numeric: "numerical",
    };
    const type = aliases[rawType] || rawType || "multiple";
    if (
      !["multiple", "truefalse", "short", "essay", "numerical"].includes(type)
    ) {
      r.errors.push(`Row ${i + 2}: type ${type} is not supported by CSV.`);
      continue;
    }
    q.type = type as Question["type"];
    if (type === "multiple") {
      q.choices = ["a", "b", "c", "d"]
        .map((letter) => ({
          id: crypto.randomUUID(),
          text: get(`choice_${letter}`),
          correct:
            get("answer").trim().toLowerCase() ===
              get(`choice_${letter}`).trim().toLowerCase() ||
            get("answer")
              .toUpperCase()
              .replace(/[()]/g, "")
              .split(/[ ,|]+/)
              .includes(letter.toUpperCase()),
          locked: false,
        }))
        .filter((c) => c.text.trim());
    } else if (type === "truefalse") {
      q.choices = [
        {
          id: crypto.randomUUID(),
          text: "True",
          correct: get("answer").toLowerCase() === "true",
          locked: false,
        },
        {
          id: crypto.randomUUID(),
          text: "False",
          correct: get("answer").toLowerCase() === "false",
          locked: false,
        },
      ];
    } else {
      q.answer = get("answer");
      q.manual = type === "short" && !q.answer;
    }
    const parsed = questionSchema.safeParse(q);
    const errors = parsed.success ? errorsFor(q) : ["Invalid marks or fields."];
    if (errors.length) r.errors.push(`Row ${i + 2}: ${errors.join(" ")}`);
    else r.questions.push(q);
  }
  return r;
}
export function readSchoolhouse(text: string): ImportReport {
  if (/<!DOCTYPE|<!ENTITY/i.test(text))
    throw new Error("XML entity declarations are not supported.");
  if (XMLValidator.validate(text) !== true)
    throw new Error("This .tst file is not valid XML.");
  const xml = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    parseAttributeValue: false,
  }).parse(text);
  const root = xml.Test;
  if (!root?.TestData)
    throw new Error("Expected a Schoolhouse Test XML document.");
  const r: ImportReport = {
    questions: [],
    warnings: [
      "Version 5 sample migration: RTF styling and document layout are not preserved. Keep your original file.",
    ],
    errors: [],
  };
  const props = (e: Record<string, unknown>) =>
    Object.fromEntries(
      (Array.isArray(e.Property)
        ? e.Property
        : e.Property
          ? [e.Property]
          : []
      ).map((p: { Name: string; Value: string }) => [p.Name, p.Value ?? ""]),
    );
  for (const [kind, items] of Object.entries(root.TestData))
    for (const item of Array.isArray(items) ? items : [items]) {
      const p = props(item);
      if (
        ![
          "MultipleChoice",
          "TrueFalse",
          "ShortAnswer",
          "LongAnswer",
          "Matching",
          "Order",
          "FillBlanks",
        ].includes(kind)
      ) {
        r.warnings.push(
          `${kind} item was skipped by the first-release importer.`,
        );
        continue;
      }
      const q = newQuestion();
      q.text = plain(p.TextString1 || "");
      q.answer = plain(p.TextString2 || "");
      q.marks = Number(p.MarksValue) || 1;
      q.category = p.Category || "";
      q.group = p.Group || "";
      q.notes = p.Notes || "";
      if (p.PictureImage) {
        const raw = p.PictureImage.replace(/\s/g, "");
        const mime = raw.startsWith("iVBOR")
          ? "png"
          : raw.startsWith("/9j/")
            ? "jpeg"
            : raw.startsWith("R0lG")
              ? "gif"
              : null;
        if (mime) q.image = `data:image/${mime};base64,${raw}`;
        else r.warnings.push(`Image in ${kind} was not recognized.`);
      }
      const map: Record<string, Question["type"]> = {
        MultipleChoice: "multiple",
        TrueFalse: "truefalse",
        ShortAnswer: "short",
        LongAnswer: "essay",
        Matching: "matching",
        Order: "ordering",
        FillBlanks: "blanks",
      };
      q.type = map[kind];
      if (q.type === "multiple" || q.type === "truefalse") {
        const raw =
          item.Choices?.ChoiceItems?.ChoiceItem || item.Choices?.ChoiceItem;
        const choices = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
        q.choices = choices.map((c: Record<string, unknown>) => {
          const v = props(c);
          return {
            id: crypto.randomUUID(),
            text: plain(v.TextString || ""),
            correct: v.SelectedKey === "True",
            locked: v.Locked === "True",
          };
        });
        if (
          choices.some((c: Record<string, unknown>) => props(c).Active !== "0")
        )
          r.warnings.push(
            `Choice activation in “${q.text.slice(0, 50)}” needs review; all choices were included.`,
          );
        if (choices.some((c: Record<string, unknown>) => props(c).Image))
          r.warnings.push("Choice images are not imported yet.");
      }
      if (["matching", "ordering", "blanks"].includes(q.type)) {
        r.warnings.push(
          `${kind}: nested answer mapping is not verified; this item was skipped.`,
        );
        continue;
      }
      if (q.type === "short") q.manual = true;
      if (/\{\{/.test(q.text) || q.choices.some((c) => /\{\{/.test(c.text))) {
        r.errors.push(
          "An item with hidden answer-key text was skipped to avoid exposing teacher-only text.",
        );
        continue;
      }
      const parsed = questionSchema.safeParse(q);
      if (!parsed.success) {
        r.errors.push(`${kind}: values exceed supported limits.`);
        continue;
      }
      const problems = errorsFor(q);
      if (problems.length) r.errors.push(`${kind}: ${problems.join(" ")}`);
      else r.questions.push(parsed.data);
    }
  return r;
}
export async function readFile(
  name: string,
  buffer: Buffer,
  csvOptions?: CsvOptions,
): Promise<ImportReport> {
  if (name.toLowerCase().endsWith(".zip")) {
    const zip = await JSZip.loadAsync(buffer);
    let total = 0;
    const files = Object.values(zip.files);
    if (files.length > 600) throw new Error("Too many files in this package.");
    for (const f of files) {
      if (f.name.includes("..") || f.name.startsWith("/"))
        throw new Error("Unsafe package path.");
      const size =
        (f as unknown as { _data?: { uncompressedSize: number } })._data
          ?.uncompressedSize || 0;
      total += size;
    }
    if (total > 20_000_000) throw new Error("Expanded package exceeds 20 MB.");
    if (zip.file("imsmanifest.xml")) return readQtiPackage(zip);
    const manifest = zip.file("manifest.json");
    if (!manifest)
      throw new Error("Expected manifest.json in a Classpaper package.");
    const raw = JSON.parse(await manifest.async("string"));
    if (raw.format !== "classpaper" || raw.version !== 1)
      throw new Error("Unsupported native package version.");
    for (const q of raw.test.questions) {
      if (q.image.startsWith("assets/")) {
        const f = zip.file(q.image);
        if (!f) throw new Error("Missing image asset.");
        const mime = q.image.endsWith(".png")
          ? "png"
          : q.image.endsWith(".gif")
            ? "gif"
            : q.image.endsWith(".webp")
              ? "webp"
              : "jpeg";
        q.image = `data:image/${mime};base64,${await f.async("base64")}`;
      }
    }
    return nativeReport(raw);
  }
  const text = (
    buffer[0] === 0xff && buffer[1] === 0xfe
      ? buffer.toString("utf16le")
      : buffer.toString("utf8")
  ).replace(/^\uFEFF/, "");
  if (name.toLowerCase().endsWith(".json"))
    return nativeReport(JSON.parse(text));
  if (name.toLowerCase().endsWith(".tst")) return readSchoolhouse(text);
  if (/\.(csv|tsv)$/i.test(name)) return readCsv(text, csvOptions);
  if (/\.xml$/i.test(name)) return readQtiItem(text);
  return readGift(text);
}
function nativeReport(raw: unknown): ImportReport {
  const v = raw as { format: string; version: number; test: unknown };
  if (v.format !== "classpaper" || v.version !== 1)
    throw new Error("Unsupported native package version.");
  const test = testSchema.parse(v.test);
  if (
    test.settings.backgroundImage &&
    !safeImage(test.settings.backgroundImage)
  )
    throw new Error("Unsupported background image.");
  for (const q of test.questions) {
    if (q.image && !safeImage(q.image))
      throw new Error("Unsupported image in native package.");
  }
  return {
    questions: cleanQuestions(test.questions),
    warnings: [],
    errors: [],
    title: test.title,
    document: { description: test.description, settings: test.settings },
  };
}
export async function nativePackage(test: unknown): Promise<Buffer> {
  const doc = testSchema.parse(test);
  const zip = new JSZip();
  for (const q of doc.questions) {
    if (q.image) {
      const m = q.image.match(/^data:image\/(png|jpeg|gif|webp);base64,(.*)$/s);
      if (!m) throw new Error("Unsupported image.");
      const name = `assets/${crypto.randomUUID()}.${m[1]}`;
      zip.file(name, m[2], { base64: true });
      q.image = name;
    }
  }
  zip.file(
    "manifest.json",
    JSON.stringify({ format: "classpaper", version: 1, test: doc }, null, 2),
  );
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
export const csvTemplate =
  'question,type,choice_a,choice_b,choice_c,choice_d,answer,marks,category\n"Which planet is closest to the Sun?",multiple,Mercury,Venus,Earth,Mars,A,1,Science\n';
export { safeImage };
