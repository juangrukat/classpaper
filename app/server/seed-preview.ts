if (process.env.NODE_ENV === "production")
  throw new Error("Preview seeding is disabled in production.");
// Development-only examples; never run automatically in production.
import { defaults, newQuestion } from "../src/domain.js";
const base = "http://localhost:3100/api";
const register = await fetch(base + "/auth/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Preview Teacher",
    email: "preview@classpaper.test",
    password: "classpaper-preview-only",
  }),
});
if (!register.ok)
  throw new Error("Preview account already exists or registration is closed.");
const cookie = register.headers.get("set-cookie")!.split(";")[0];
const choice = (text: string, answers: string[], correct: number) => {
  const q = newQuestion();
  q.text = text;
  q.choices = answers.map((text, i) => ({
    id: crypto.randomUUID(),
    text,
    correct: i === correct,
    locked: false,
  }));
  return q;
};
const planet = choice(
  "Which planet is closest to the Sun?",
  ["Mercury", "Venus", "Earth", "Mars"],
  0,
);
const tf = newQuestion("truefalse");
tf.text = "The Earth takes approximately 365 days to orbit the Sun.";
const short = newQuestion("short");
short.text = "What force keeps the planets in orbit around the Sun?";
short.answer = "Gravity";
short.manual = false;
const match = newQuestion("matching");
match.text = "Match each object with its description.";
match.pairs = [
  { id: crypto.randomUUID(), left: "The Sun", right: "A star" },
  { id: crypto.randomUUID(), left: "The Moon", right: "A natural satellite" },
  { id: crypto.randomUUID(), left: "Earth", right: "A planet" },
];
const essay = newQuestion("essay");
essay.text = "Explain why we experience day and night.";
essay.answer =
  "Earth rotates on its axis, causing different parts to face the Sun.";
essay.marks = 3;
const tests = [
  {
    title: "The solar system · Year 7",
    description: "A little curiosity about our place in the universe.",
    questions: [planet, tf, short, match, essay],
  },
  {
    title: "Reading comprehension · Year 6",
    description: "Read closely. Find the clues. Make your case.",
    questions: [
      choice(
        "Which word describes the main character’s attitude?",
        ["Curious", "Indifferent", "Resentful", "Fearful"],
        0,
      ),
      {
        ...newQuestion("essay"),
        text: "Use evidence from the passage to explain your answer.",
        marks: 3,
      },
    ],
  },
  {
    title: "Fractions quick check · Year 5",
    description: "A five-minute check for the next step in learning.",
    questions: [
      choice(
        "Which fraction is equivalent to one half?",
        ["2/4", "1/3", "2/3", "3/4"],
        0,
      ),
      {
        ...newQuestion("numerical"),
        text: "What is one quarter of 20?",
        answer: "5",
      },
    ],
  },
];
for (const test of tests) {
  const r = await fetch(base + "/tests", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ ...test, settings: defaults }),
  });
  if (!r.ok) throw new Error(await r.text());
}
await fetch(base + "/bank", {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: cookie },
  body: JSON.stringify({ ...planet, category: "Science" }),
});
console.log("Preview-only examples created.");
