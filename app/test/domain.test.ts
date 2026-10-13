import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaults,
  newQuestion,
  grade,
  materialize,
  publicQuestion,
  errorsFor,
} from "../src/domain.js";
test("choice scoring uses stable IDs, accepts multiple answers, rejects duplicates", () => {
  const q = newQuestion();
  q.choices[0].correct = true;
  q.choices[2].correct = true;
  assert.equal(grade(q, [q.choices[2].id, q.choices[0].id]).earned, 1);
  assert.equal(grade(q, [q.choices[0].id, q.choices[0].id]).earned, 0);
  assert.equal(grade(q, [q.choices[0].id]).earned, 0);
});
test("locked choices retain position and shuffling retains every answer identity", () => {
  const q = newQuestion();
  q.choices[2].locked = true;
  q.choices[1].correct = true;
  for (let i = 0; i < 30; i++) {
    const [v] = materialize([q], { ...defaults, shuffleChoices: true });
    assert.equal(v.choices[2].id, q.choices[2].id);
    assert.deepEqual(
      v.choices.map((c) => c.id).sort(),
      q.choices.map((c) => c.id).sort(),
    );
    assert.equal(grade(v, q.choices[1].id).earned, 1);
  }
});
test("adjacent grouped questions stay together when shuffled", () => {
  const a = newQuestion(),
    b = newQuestion(),
    c = newQuestion();
  a.group = b.group = "shared picture";
  for (let i = 0; i < 30; i++) {
    const qs = materialize([a, b, c], { ...defaults, shuffleQuestions: true });
    assert.equal(
      qs.findIndex((q) => q.id === b.id) - qs.findIndex((q) => q.id === a.id),
      1,
    );
  }
});
test("student projections exclude private grading fields and match mappings", () => {
  const q = newQuestion("matching");
  q.answer = "SECRET";
  q.notes = "SECRET NOTE";
  q.pairs = [{ id: "pair", left: "Question", right: "Answer" }];
  const p = publicQuestion(q);
  assert.equal("answer" in p, false);
  assert.equal("notes" in p, false);
  assert.equal("right" in p.pairs[0], false);
  assert.equal("correct" in p.choices[0], false);
});
test("manual answers stay pending, numeric answers reject blanks and accept tolerance", () => {
  const q = newQuestion("essay");
  assert.equal(grade(q, "an essay").manual, true);
  const n = newQuestion("numerical");
  n.answer = "4";
  n.tolerance = 0.1;
  assert.equal(grade(n, "").earned, 0);
  assert.equal(grade(n, "4.05").earned, 1);
  assert.equal(grade(n, "4.2").earned, 0);
});
test("short answer normalization and blank validation are explicit", () => {
  const q = newQuestion("short");
  q.manual = false;
  q.answer = "New York|NYC";
  assert.equal(grade(q, " new  YORK ").earned, 1);
  const b = newQuestion("blanks");
  b.text = "___ and ___";
  b.answer = "one";
  assert(errorsFor(b).some((e) => e.includes("one answer per blank")));
});
test("specialist public projections conceal list, part and table answer guides", () => {
  const q = newQuestion("multipart");
  q.pairs = [{ id: "p", left: "Explain why", right: "SECRET guide", marks: 2 }];
  assert(
    !JSON.stringify(publicQuestion(q, ["SECRET guide"])).includes("SECRET"),
  );
  const table = newQuestion("table");
  table.table = [
    [
      { id: "cell", text: "SECRET cell", blank: true },
      { id: "label", text: "Visible label", blank: false },
    ],
  ];
  const p = publicQuestion(table);
  assert.equal(p.table[0][0].text, "");
  assert.equal(p.table[0][1].text, "Visible label");
  assert.equal(grade(table, { cell: "secret CELL" }).earned, 1);
  const list = newQuestion("list");
  list.pairs = [{ id: "i", left: "SECRET item", right: "" }];
  assert(!JSON.stringify(publicQuestion(list)).includes("SECRET"));
});
test("choice limits preserve mandatory choices and reject impossible limits", () => {
  const q = newQuestion();
  q.text = "Pick";
  q.choices.forEach((c, i) => (c.text = String(i)));
  q.choices[0].correct = true;
  q.choices[1].locked = true;
  q.choiceLimit = 2;
  const [v] = materialize([q], defaults);
  assert.equal(v.choices.length, 2);
  assert(v.choices.some((c) => c.correct));
  assert(v.choices.some((c) => c.locked));
  q.choiceLimit = 1;
  assert(errorsFor(q).some((e) => e.includes("Choice limit")));
});
test("original picture and editing recipe remain private", () => {
  const q = newQuestion();
  q.imageOriginal = "data:image/png;base64,U0VDUkVU";
  q.imageRecipe = "private original edits";
  const p = publicQuestion(q);
  assert(!("imageOriginal" in p));
  assert(!("imageRecipe" in p));
});
test("multi-match includes unused choices without revealing its answer mapping", () => {
  const q = newQuestion("multimatch");
  q.matchOptions = ["Unused option"];
  q.pairs = [
    { id: "1", left: "A", right: "Shared answer" },
    { id: "2", left: "B", right: "Shared answer" },
  ];
  const p = publicQuestion(q);
  assert(p.options.includes("Unused option"));
  assert(p.options.includes("Shared answer"));
  assert(!("right" in p.pairs[0]));
  assert.equal(
    grade(q, { "1": "Shared answer", "2": "Shared answer" }).earned,
    1,
  );
});
