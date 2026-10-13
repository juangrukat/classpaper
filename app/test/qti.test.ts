import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "../server/interchange.js";
import { readQtiItem, qtiPackage } from "../server/qti.js";
import { newQuestion } from "../src/domain.js";
import { readFile as readFs } from "node:fs/promises";
test("independent official QTI choice fixture imports and reports missing image", async () => {
  const r = await readQtiItem(
    await readFs("test/fixtures/qti/choice.xml", "utf8"),
  );
  assert.equal(r.questions.length, 1);
  assert.equal(r.questions[0].choices.length, 3);
  assert.equal(r.questions[0].choices.filter((c) => c.correct).length, 1);
  assert(r.warnings.some((w) => w.includes("Missing picture")));
});
test("official QTI ordering preserves correct ordering, mapped scoring is rejected", async () => {
  const r = await readQtiItem(
    await readFs("test/fixtures/qti/order.xml", "utf8"),
  );
  assert.equal(r.questions[0].type, "ordering");
  assert.equal(r.questions[0].pairs.length, 3);
  await assert.rejects(
    async () =>
      readQtiItem(
        await readFs("test/fixtures/qti/choice_multiple.xml", "utf8"),
      ),
    /partial-credit/,
  );
});
test("official scorer rubric is private teacher guidance, not question text", async () => {
  const r = await readQtiItem(
    await readFs("test/fixtures/qti/extended_text_rubric.xml", "utf8"),
  );
  assert.equal(r.questions[0].type, "essay");
  assert(r.questions[0].answer.includes("Scoring Guidelines"));
  assert(!r.questions[0].text.includes("Scoring Guidelines"));
});
test("QTI package exports score-preserving processing and imports referenced items", async () => {
  const q = newQuestion();
  q.text = "Which?";
  q.marks = 3;
  q.choices = q.choices.slice(0, 2);
  q.choices[0].text = "A";
  q.choices[0].correct = true;
  q.choices[1].text = "B";
  const e = newQuestion("essay");
  e.text = "Explain";
  e.answer = "Private guide";
  e.marks = 4;
  const pack = await qtiPackage({ title: "Demo", questions: [q, e] });
  const r = await readFile("qti.zip", pack.buffer);
  assert.equal(r.title, "Demo");
  assert.equal(r.questions.length, 2);
  assert.equal(r.questions[0].marks, 3);
  assert(r.questions[0].choices[0].correct);
  assert.equal(r.questions[1].marks, 4);
  assert.equal(r.questions[1].answer, "Private guide");
});
test("unknown template URIs cannot silently acquire standard scoring semantics", async () => {
  const source = (await readFs("test/fixtures/qti/choice.xml", "utf8")).replace(
    "http://www.imsglobal.org/question/qti_v2p1/rptemplates/match_correct",
    "https://example.invalid/custom/match_correct",
  );
  await assert.rejects(() => readQtiItem(source), /all-or-nothing/);
});
