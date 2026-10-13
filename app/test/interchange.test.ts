import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readFile,
  readGift,
  exportGift,
  nativePackage,
  readCsv,
  readSchoolhouse,
} from "../server/interchange.js";
import { defaults, newQuestion } from "../src/domain.js";
import { readFile as readFs } from "node:fs/promises";
import { existsSync } from "node:fs";
test("GIFT reserved characters and Unicode survive export and parsing", () => {
  const q = newQuestion();
  q.text = "¿Which # symbol equals a {brace}: ~ = \\?";
  q.choices = [
    { id: "yes", text: "Sí = #", correct: true, locked: false },
    { id: "no", text: "No { }", correct: false, locked: false },
  ];
  const exported = exportGift([q]);
  assert.equal(exported.warnings.length, 0);
  const parsed = readGift(exported.text);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.questions[0].text, q.text);
  assert.equal(parsed.questions[0].choices[0].text, q.choices[0].text);
  assert(parsed.questions[0].choices[0].correct);
});
test("partial-credit GIFT is explicitly rejected instead of silently changing marks", () => {
  const r = readGift("Weighted {~%50%Half ~%100%Full ~%0%Wrong}");
  assert(r.errors.length > 0);
  assert.equal(r.questions.length, 0);
});
test("malformed GIFT can show valid questions and precise issues separately", () => {
  const r = readGift("Valid {=yes ~no}\n\nBroken {=missing");
  assert(r.errors.length);
  assert.equal(r.questions.length, 1);
});
test("native ZIP preserves full data, embedded image and grading fields", async () => {
  const q = newQuestion();
  q.text = "Sample";
  q.choices[0].text = "A";
  q.choices[0].correct = true;
  q.choices[1].text = "B";
  q.choices = q.choices.slice(0, 2);
  q.image = "data:image/png;base64,iVBORw0KGgo=";
  q.notes = "Private note";
  q.group = "Group";
  q.marks = 3;
  const original = {
    title: "Test",
    description: "Instructions",
    questions: [q],
    settings: defaults,
  };
  const result = await readFile("test.zip", await nativePackage(original));
  assert.deepEqual(result.questions, original.questions);
  assert.deepEqual(result.warnings, []);
});
test("CSV handles quoted commas and multiline questions", () => {
  const r = readCsv(
    'question,type,choice_a,choice_b,answer,marks\n"One, two\nthree?",multiple,"Yes, indeed",No,A,2\n',
  );
  assert.equal(r.questions[0].text, "One, two\nthree?");
  assert.equal(r.questions[0].choices[0].text, "Yes, indeed");
  assert.equal(r.questions[0].marks, 2);
});
test("recovered Schoolhouse samples migrate with visible conversion warnings", { skip: !existsSync("../analysis/payload/solar_system_sample_v5.tst") }, async () => {
  for (const file of [
    "solar_system_sample_v5.tst",
    "geology_sample_v5.tst",
    "french_english_sample_v5.tst",
    "template1.tst",
  ]) {
    const r = readSchoolhouse(
      await readFs(`../analysis/payload/${file}`, "utf8"),
    );
    if (file === "template1.tst") {
      assert.equal(r.questions.length, 0);
      assert(r.errors.some((e) => e.includes("Mark the correct answer")));
    } else assert(r.questions.length > 0, file);
    assert(r.warnings.length > 0);
    for (const q of r.questions.filter((q) => q.type === "multiple"))
      assert(q.choices.some((c) => c.correct));
  }
});
test("unsupported QTI is rejected clearly", async () => {
  await assert.rejects(
    () =>
      readFile(
        "qti.xml",
        Buffer.from(
          '<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"/>',
        ),
      ),
    /namespace/,
  );
});
test("native rich text survives while executable content is removed", async () => {
  const q = newQuestion();
  q.richText =
    '<p style="text-align: justify">A <strong>bold</strong> question</p><script>alert(1)</script>';
  q.text = "A bold question";
  const r = await readFile(
    "safe.zip",
    await nativePackage({
      title: "Safe",
      description: "",
      questions: [q],
      settings: defaults,
    }),
  );
  assert(r.questions[0].richText.includes("text-align:justify"));
  assert(r.questions[0].richText.includes("<strong>"));
  assert(!r.questions[0].richText.includes("script"));
});
test("CSV column mapping works with school-specific names and no header row", () => {
  const text =
    "Prompt,Option one,Option two,Key\nClosest planet?,Mercury,Venus,A\n";
  const first = readCsv(text);
  assert(first.csv);
  const mapped = readCsv(text, {
    hasHeaders: true,
    mapping: { question: 0, choice_a: 1, choice_b: 2, answer: 3 },
  });
  assert.equal(mapped.questions.length, 1);
  assert(mapped.questions[0].choices[0].correct);
  const noHeader = readCsv("Closest planet?,Mercury,Venus,A", {
    hasHeaders: false,
    mapping: { question: 0, choice_a: 1, choice_b: 2, answer: 3 },
  });
  assert.equal(noHeader.questions.length, 1);
});
test("UTF-8 BOM spreadsheets and uppercase extensions import correctly", async () => {
  const r = await readFile(
    "QUESTIONS.CSV",
    Buffer.from(
      "\uFEFFquestion,type,choice_a,choice_b,answer\nPick?,multiple,Yes,No,A",
    ),
  );
  assert.equal(r.questions.length, 1);
});
test("teacher-friendly CSV type labels and answer text are accepted", () => {
  const r = readCsv(
    "question,type,choice_a,choice_b,answer\nClosest?,Multiple choice,Mercury,Venus,Mercury\nGravity?,Short answer,,,Gravity",
  );
  assert.equal(r.questions.length, 2);
  assert(r.questions[0].choices[0].correct);
  assert.equal(r.questions[1].type, "short");
  assert.equal(r.questions[1].manual, false);
});

test("independent GIFT file imports six common question types through file dispatch", async () => {
  const r = await readFile("common-questions.gift", await readFs("test/fixtures/common-questions.gift"));
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.questions.map(q => q.type), ["multiple", "truefalse", "short", "essay", "matching", "numerical"]);
  assert(r.questions.every(q => q.category === "Science"));
  assert.equal(r.questions[0].choices.find(c => c.correct)?.text, "Mercury");
  assert.equal(r.questions[1].choices.find(c => c.correct)?.text, "True");
  assert.equal(r.questions[2].answer, "Gravity|gravitation");
  assert.equal(r.questions[4].pairs.length, 3);
  assert.equal(r.questions[5].answer, "60");
  assert.equal(r.questions[5].tolerance, 0);
  assert(r.warnings.some(w => w.includes("title")));
});
