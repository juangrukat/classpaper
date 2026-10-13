import { defaults, newQuestion } from "../src/domain.js";
const base = "http://localhost:3100";
const login = await fetch(base + "/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "preview@classpaper.test",
    password: "classpaper-preview-only",
  }),
});
if (!login.ok) throw new Error("Preview account missing");
const cookie = login.headers.get("set-cookie")!.split(";")[0];
const q = newQuestion("selection");
q.text = "The ___ orbits the ___.";
q.selections = ["Earth", "Sun"].map((text) => ({
  id: crypto.randomUUID(),
  choices: [
    { id: crypto.randomUUID(), text, correct: true, locked: false },
    { id: crypto.randomUUID(), text: "Moon", correct: false, locked: false },
  ],
}));
const diagram = newQuestion("diagram");
diagram.text =
  "Draw the Earth and the Sun. Add labels to show their positions.";
diagram.marks = 2;
const parts = newQuestion("multipart");
parts.text = "Explain day and night.";
parts.pairs = [
  {
    id: "a",
    left: "Describe the movement of Earth.",
    right: "Earth rotates on its axis.",
    marks: 2,
  },
  {
    id: "b",
    left: "Explain which side experiences daylight.",
    right: "The side facing the Sun.",
    marks: 1,
  },
];
parts.marks = 3;
const doc = {
  title: "Production classroom check",
  description:
    "Fictional sample: inline choices, drawing and per-part grading.",
  questions: [q, diagram, parts],
  settings: {
    ...defaults,
    titleStyle: "exam",
    sheetStyle: "lined",
    timeLimit: 20,
    feedback: "answers",
  },
};
async function request(url: string, method = "GET", body?: unknown) {
  const r = await fetch(base + "/api" + url, {
    method,
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error);
  return d;
}
const created = await request("/tests", "POST", doc),
  shared = await request(`/tests/${created.id}/publish`, "POST", {});
await request("/import", "POST", {
  name: "original-qa.aiken",
  data: Buffer.from("Quick check?\nA. Yes\nB. No\nANSWER: A").toString(
    "base64",
  ),
});
console.log(JSON.stringify({ id: created.id, url: base + shared.url }));
