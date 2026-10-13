import express from "express";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import path from "node:path";
import { query, init, transaction } from "./db.js";
import {
  testSchema,
  settingsSchema,
  questionSchema,
  errorsFor,
  grade,
  materialize,
  publicQuestion,
  shuffle,
  type Question,
  type Settings,
  type ResponseValue,
  type Grade,
} from "../src/domain.js";
import {
  readFile,
  exportGift,
  nativePackage,
  csvTemplate,
  safeImage,
} from "./interchange.js";
import { cleanQuestions } from "./content.js";
import { qtiPackage } from "./qti.js";
await init();
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "26mb" }));
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.use("/api", (req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.origin;
    if (
      origin &&
      origin !== `${req.protocol}://${req.headers.host}` &&
      origin !== process.env.PUBLIC_URL
    ) {
      res
        .status(403)
        .json({ error: "This request came from a different site." });
      return;
    }
  }
  next();
});
const token = () => randomBytes(32).toString("hex");
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const cookie = (req: express.Request) =>
  req.headers.cookie
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("classpaper="))
    ?.slice(11) || "";
const limits = new Map<string, { count: number; until: number }>();
function rate(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const key = req.baseUrl + ":" + (req.ip || "local");
  const now = Date.now();
  let l = limits.get(key);
  if (!l || l.until < now) {
    l = { count: 0, until: now + 60000 };
    limits.set(key, l);
  }
  if (++l.count > (req.baseUrl.startsWith("/api/join") ? 180 : 30)) {
    res.status(429).json({ error: "Too many requests. Please wait a minute." });
    return;
  }
  next();
}
app.use("/api/auth", rate);
app.use("/api/join", rate);
async function user(req: express.Request) {
  const rows = await query<{ id: string; email: string; name: string }>(
    `SELECT u.id,u.email,u.name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=$1 AND s.expires>$2`,
    [hash(cookie(req)), Date.now()],
  );
  return rows[0];
}
const auth: express.RequestHandler = async (req, res, next) => {
  const u = await user(req);
  if (!u) {
    res.status(401).json({ error: "Please sign in." });
    return;
  }
  res.locals.user = u;
  next();
};
app.get("/api/auth/me", async (req, res) =>
  res.json({
    user: (await user(req)) || null,
    setup: (await query("SELECT id FROM users LIMIT 1")).length === 0,
  }),
);
app.post("/api/auth/register", async (req, res) => {
  const { email, name, password } = req.body;
  if (
    process.env.ALLOW_REGISTRATION !== "true" &&
    (await query("SELECT id FROM users LIMIT 1")).length
  ) {
    res.status(403).json({
      error:
        "New teacher registration is closed. Ask the server administrator to enable it.",
    });
    return;
  }
  if (
    typeof email !== "string" ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    email.length > 200 ||
    typeof name !== "string" ||
    !name.trim() ||
    name.length > 100 ||
    typeof password !== "string" ||
    password.length < 10 ||
    password.length > 200
  ) {
    res.status(400).json({
      error:
        "Enter your name, email and a password with at least 10 characters.",
    });
    return;
  }
  const salt = token();
  try {
    const id = crypto.randomUUID();
    await query(
      "INSERT INTO users(id,email,name,password) VALUES($1,$2,$3,$4)",
      [
        id,
        email.toLowerCase(),
        name.trim(),
        salt + ":" + scryptSync(password, salt, 64).toString("hex"),
      ],
    );
    await login(res, id);
    res.json({ user: { id, email: email.toLowerCase(), name: name.trim() } });
  } catch {
    res.status(409).json({ error: "This email is already registered." });
  }
});
async function login(res: express.Response, id: string) {
  const t = token();
  await query("INSERT INTO sessions(token,user_id,expires) VALUES($1,$2,$3)", [
    hash(t),
    id,
    Date.now() + 7 * 86400000,
  ]);
  res.cookie("classpaper", t, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.COOKIE_SECURE === "true",
    maxAge: 7 * 86400000,
    path: "/",
  });
}
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    password.length > 200
  ) {
    res.status(400).json({ error: "Enter an email and password." });
    return;
  }
  const [u] = await query<{
    id: string;
    email: string;
    name: string;
    password: string;
  }>("SELECT * FROM users WHERE email=$1", [email.toLowerCase()]);
  const [salt, saved] = (u?.password || `${token()}:${"0".repeat(128)}`).split(
    ":",
  );
  const good = timingSafeEqual(
    scryptSync(password, salt, 64),
    Buffer.from(saved, "hex"),
  );
  if (!u || !good) {
    res.status(401).json({ error: "The email or password does not match." });
    return;
  }
  await login(res, u.id);
  res.json({ user: { id: u.id, email: u.email, name: u.name } });
});
app.post("/api/auth/logout", async (req, res) => {
  await query("DELETE FROM sessions WHERE token=$1", [hash(cookie(req))]);
  res.clearCookie("classpaper", { path: "/" });
  res.json({ ok: true });
});
app.use("/api/tests", auth);
app.use("/api/presets", auth);
app.use("/api/bank", auth);
app.use("/api/import", auth);
app.use("/api/results", auth);
type Doc = {
  title: string;
  description: string;
  questions: Question[];
  settings: Settings;
};
type TestRow = { id: string; doc: Doc; revision: number; updated_at: string };
async function owned(id: string, userId: string) {
  return (
    await query<TestRow>("SELECT * FROM tests WHERE id=$1 AND user_id=$2", [
      id,
      userId,
    ])
  )[0];
}
app.get("/api/presets", async (_req, res) =>
  res.json(
    await query(
      "SELECT id,name,settings FROM presets WHERE user_id=$1 ORDER BY name",
      [res.locals.user.id],
    ),
  ),
);
app.post("/api/presets", async (req, res) => {
  const settings = settingsSchema.parse(req.body.settings);
  const name = req.body.name;
  if (typeof name !== "string" || !name.trim() || name.length > 100)
    throw new Error("Enter a preset name.");
  const id = crypto.randomUUID();
  await query(
    "INSERT INTO presets(id,user_id,name,settings) VALUES($1,$2,$3,$4)",
    [id, res.locals.user.id, name.trim(), JSON.stringify(settings)],
  );
  res.status(201).json({ id, name: name.trim(), settings });
});
app.get("/api/tests", async (_req, res) =>
  res.json(
    await query(
      `SELECT t.id,t.doc->>'title' AS title,t.doc->>'description' AS description,jsonb_array_length(t.doc->'questions') AS count,t.updated_at,t.revision,(SELECT p.code FROM publications p WHERE p.test_id=t.id AND p.open=true ORDER BY p.created_at DESC LIMIT 1) AS published FROM tests t WHERE t.user_id=$1 ORDER BY t.updated_at DESC`,
      [res.locals.user.id],
    ),
  ),
);
app.post("/api/tests", async (req, res) => {
  const doc = testSchema.parse(req.body);
  cleanQuestions(doc.questions);
  if (doc.settings.backgroundImage && !safeImage(doc.settings.backgroundImage))
    throw new Error("Unsupported background image.");
  const id = crypto.randomUUID();
  await query("INSERT INTO tests(id,user_id,doc) VALUES($1,$2,$3)", [
    id,
    res.locals.user.id,
    JSON.stringify(doc),
  ]);
  res.status(201).json({ id, ...doc, revision: 1 });
});
app.get("/api/tests/:id", async (req, res) => {
  const row = await owned(req.params.id, res.locals.user.id);
  if (!row) {
    res.status(404).json({ error: "Test not found." });
    return;
  }
  res.json({ id: row.id, ...row.doc, revision: row.revision });
});
app.put("/api/tests/:id", async (req, res) => {
  const doc = testSchema.parse(req.body);
  cleanQuestions(doc.questions);
  if (doc.settings.backgroundImage && !safeImage(doc.settings.backgroundImage))
    throw new Error("Unsupported background image.");
  if (!Number.isInteger(req.body.revision)) {
    res.status(400).json({ error: "Missing saved revision." });
    return;
  }
  for (const q of doc.questions)
    if (q.image && !safeImage(q.image))
      throw new Error("Use PNG, JPEG, GIF or WebP images.");
  const rows = await query<TestRow>(
    "UPDATE tests SET doc=$1,revision=revision+1,updated_at=now() WHERE id=$2 AND user_id=$3 AND revision=$4 RETURNING *",
    [JSON.stringify(doc), req.params.id, res.locals.user.id, req.body.revision],
  );
  if (!rows.length) {
    res.status(409).json({
      error:
        "This test changed in another tab. Reload before saving; your current edits are still on screen.",
    });
    return;
  }
  res.json({ revision: rows[0].revision });
});
app.delete("/api/tests/:id", async (req, res) => {
  const rows = await query(
    "UPDATE publications SET open=false WHERE test_id=$1 AND user_id=$2 RETURNING code",
    [req.params.id, res.locals.user.id],
  );
  res.json({ ok: true, closed: rows.length });
});
app.post("/api/tests/:id/publish", async (req, res) => {
  const row = await owned(req.params.id, res.locals.user.id);
  if (!row) {
    res.status(404).json({ error: "Test not found." });
    return;
  }
  const errors = row.doc.questions.flatMap((q, i) =>
    errorsFor(q).map((x) => `Question ${i + 1}: ${x}`),
  );
  if (!row.doc.questions.length) errors.push("Add at least one question.");
  if (errors.length) {
    res.status(400).json({ error: errors.join("\n") });
    return;
  }
  const code = randomBytes(6).toString("hex");
  await query(
    "INSERT INTO publications(code,test_id,user_id,doc) VALUES($1,$2,$3,$4)",
    [code, row.id, res.locals.user.id, JSON.stringify(row.doc)],
  );
  res.json({ code, url: `/take/${code}` });
});
app.post("/api/tests/:id/print", async (req, res) => {
  const row = await owned(req.params.id, res.locals.user.id);
  if (!row) {
    res.status(404).json({ error: "Test not found." });
    return;
  }
  const version = randomBytes(8).toString("hex").toUpperCase();
  const doc = {
    ...row.doc,
    questions: materialize(row.doc.questions, row.doc.settings),
    version,
  };
  await query(
    "INSERT INTO print_versions(version,test_id,user_id,doc) VALUES($1,$2,$3,$4)",
    [version, row.id, res.locals.user.id, JSON.stringify(doc)],
  );
  res.json(doc);
});
app.get("/api/tests/:id/print/:version", async (req, res) => {
  const [row] = await query<{ doc: Doc }>(
    "SELECT doc FROM print_versions WHERE version=$1 AND test_id=$2 AND user_id=$3",
    [req.params.version, req.params.id, res.locals.user.id],
  );
  if (!row) {
    res.status(404).json({ error: "Print version not found." });
    return;
  }
  res.json(row.doc);
});
app.get("/api/tests/:id/export/:format", async (req, res) => {
  const row = await owned(req.params.id, res.locals.user.id);
  if (!row) {
    res.status(404).json({ error: "Test not found." });
    return;
  }
  if (req.params.format === "gift") {
    res.json(exportGift(row.doc.questions));
    return;
  }
  if (req.params.format === "qti") {
    const result = await qtiPackage(row.doc);
    if (req.query.preview === "1") {
      res.json({ warnings: result.warnings });
      return;
    }
    res
      .type("application/zip")
      .setHeader(
        "Content-Disposition",
        'attachment; filename="classpaper-qti.zip"',
      );
    res.send(result.buffer);
    return;
  }
  if (req.params.format === "native") {
    res
      .type("application/zip")
      .setHeader(
        "Content-Disposition",
        'attachment; filename="classpaper.zip"',
      );
    res.send(await nativePackage(row.doc));
    return;
  }
  res.status(400).json({ error: "This format is not supported yet." });
});
app.post("/api/import", async (req, res) => {
  if (typeof req.body.name !== "string" || typeof req.body.data !== "string")
    throw new Error("Choose a file to import.");
  const buffer = Buffer.from(req.body.data, "base64");
  if (buffer.length > 15_000_000)
    throw new Error("Choose a file smaller than 15 MB.");
  res.json(await readFile(req.body.name, buffer, req.body.csv));
});
app.get("/api/template.csv", (_req, res) =>
  res.type("text/csv").send(csvTemplate),
);
app.get("/api/bank", async (_req, res) =>
  res.json(
    (
      await query<{ id: string; question: Question }>(
        "SELECT * FROM bank WHERE user_id=$1 ORDER BY updated_at DESC",
        [res.locals.user.id],
      )
    ).map((x) => x.question),
  ),
);
app.post("/api/bank", async (req, res) => {
  const question = questionSchema.parse(req.body);
  cleanQuestions([question]);
  if (question.image && !safeImage(question.image))
    throw new Error("Unsupported image.");
  question.id = crypto.randomUUID();
  await query("INSERT INTO bank(id,user_id,question) VALUES($1,$2,$3)", [
    question.id,
    res.locals.user.id,
    JSON.stringify(question),
  ]);
  res.status(201).json(question);
});
app.delete("/api/bank/:id", async (req, res) => {
  await query("DELETE FROM bank WHERE id=$1 AND user_id=$2", [
    req.params.id,
    res.locals.user.id,
  ]);
  res.json({ ok: true });
});
app.get("/api/join/:code", async (req, res) => {
  const [p] = await query<{ doc: Doc; open: boolean }>(
    "SELECT doc,open FROM publications WHERE code=$1",
    [req.params.code],
  );
  if (!p || !p.open) {
    res.status(404).json({
      error: "This test is not available. Please contact your teacher.",
    });
    return;
  }
  res.json({
    title: p.doc.title,
    description: p.doc.description,
    count: p.doc.questions.length,
    timeLimit: p.doc.settings.timeLimit,
    accessCode: !!p.doc.settings.accessCode,
  });
});
app.post("/api/join/:code", async (req, res) => {
  await transaction(async (tx) => {
    const [p] = await tx<{ doc: Doc; open: boolean }>(
      "SELECT doc,open FROM publications WHERE code=$1 FOR UPDATE",
      [req.params.code],
    );
    if (!p || !p.open) {
      res.status(404).json({ error: "This test is closed." });
      return;
    }
    if (
      p.doc.settings.accessCode &&
      (typeof req.body.accessCode !== "string" ||
        !timingSafeEqual(
          Buffer.from(hash(req.body.accessCode)),
          Buffer.from(hash(p.doc.settings.accessCode)),
        ))
    ) {
      res.status(403).json({ error: "The access code does not match." });
      return;
    }
    const { name, studentId } = req.body;
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 100 ||
      typeof studentId !== "string" ||
      !studentId.trim() ||
      studentId.length > 100
    ) {
      res.status(400).json({ error: "Enter your name and student ID." });
      return;
    }
    const previous = await tx(
      "SELECT id FROM attempts WHERE code=$1 AND student_id=$2",
      [req.params.code, studentId.trim()],
    );
    if (previous.length >= p.doc.settings.attempts) {
      res.status(403).json({
        error:
          "You have already started the allowed number of attempts. Resume on the original browser or ask your teacher for a new test link.",
      });
      return;
    }
    const qs = materialize(p.doc.questions, p.doc.settings);
    const display = qs.map((q) => {
      const pub = publicQuestion(
        q,
        shuffle([
          ...new Set(
            [...(q.matchOptions || []), ...q.pairs.map((x) => x.right)].filter(
              (x) => x.trim(),
            ),
          ),
        ]),
      );
      if (q.type === "ordering") pub.pairs = shuffle(pub.pairs);
      return pub;
    });
    const id = crypto.randomUUID(),
      t = token(),
      now = Date.now();
    await tx(
      "INSERT INTO attempts(id,code,name,student_id,token,questions,display,started,deadline) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        id,
        req.params.code,
        name.trim(),
        studentId.trim(),
        hash(t),
        JSON.stringify(qs),
        JSON.stringify(display),
        now,
        p.doc.settings.timeLimit
          ? now + p.doc.settings.timeLimit * 60000
          : null,
      ],
    );
    res.status(201).json({ id, token: t });
  });
});
type Attempt = {
  id: string;
  code: string;
  name: string;
  student_id: string;
  token: string;
  questions: Question[];
  display: unknown[];
  responses: Record<string, ResponseValue>;
  started: string;
  deadline: string | null;
  status: string;
  grades: Record<string, Grade>;
  overrides: Record<string, { earned: number; feedback: string }>;
  submitted: string | null;
};
async function getAttempt(req: express.Request) {
  const t = req.headers["x-attempt-token"];
  if (typeof t !== "string") return null;
  return (
    (
      await query<Attempt>("SELECT * FROM attempts WHERE id=$1 AND token=$2", [
        req.params.id,
        hash(t),
      ])
    )[0] || null
  );
}
async function finish(a: Attempt) {
  return transaction(async (tx) => {
    const [latest] = await tx<Attempt>(
      "SELECT * FROM attempts WHERE id=$1 FOR UPDATE",
      [a.id],
    );
    if (latest.status !== "active") return latest;
    const grades = Object.fromEntries(
      latest.questions.map((q) => [q.id, grade(q, latest.responses[q.id])]),
    );
    const [finished] = await tx<Attempt>(
      `UPDATE attempts SET status='submitted',grades=$1,submitted=$2 WHERE id=$3 RETURNING *`,
      [JSON.stringify(grades), Date.now(), a.id],
    );
    return finished;
  });
}
app.get("/api/attempts/:id", async (req, res) => {
  let a = await getAttempt(req);
  if (!a) {
    res.status(401).json({
      error: "This attempt cannot be opened. Use your original browser.",
    });
    return;
  }
  if (a.status === "active" && a.deadline && Date.now() >= Number(a.deadline))
    a = await finish(a);
  const [p] = await query<{ doc: Doc }>(
    "SELECT doc FROM publications WHERE code=$1",
    [a.code],
  );
  const grades = Object.fromEntries(
    Object.entries(a.grades).map(([id, g]) => [
      id,
      a.overrides[id]
        ? { ...g, earned: a.overrides[id].earned, manual: false }
        : g,
    ]),
  );
  const total = Object.values(grades).reduce((s, g) => s + g.earned, 0);
  const possible = a.questions.reduce((s, q) => s + q.marks, 0);
  res.json({
    id: a.id,
    title: p.doc.title,
    name: a.name,
    questions: a.display,
    responses: a.responses,
    deadline: a.deadline,
    status: a.status,
    serverNow: Date.now(),
    result:
      a.status === "submitted"
        ? {
            score: p.doc.settings.feedback === "none" ? null : total,
            possible,
            pending: Object.values(grades).some((g) => g.manual),
            answers:
              p.doc.settings.feedback === "answers"
                ? a.questions.map((q) => ({
                    id: q.id,
                    answer: answerText(q),
                    feedback: a.overrides[q.id]?.feedback || "",
                    grade: grades[q.id],
                  }))
                : null,
          }
        : null,
  });
});
app.put("/api/attempts/:id/answers", async (req, res) => {
  const a = await getAttempt(req);
  if (!a) {
    res.status(401).json({ error: "Attempt not found." });
    return;
  }
  if (
    a.status !== "active" ||
    (a.deadline && Date.now() >= Number(a.deadline))
  ) {
    if (a.status === "active") await finish(a);
    res.status(409).json({
      error: "This attempt has ended. Your saved answers have been submitted.",
    });
    return;
  }
  const responses = req.body.responses;
  if (
    !responses ||
    Array.isArray(responses) ||
    typeof responses !== "object" ||
    Object.keys(responses).some(
      (id) => !a.questions.some((q) => q.id === id),
    ) ||
    JSON.stringify(responses).length > 8000000
  ) {
    res.status(400).json({ error: "Invalid answers." });
    return;
  }
  for (const v of Object.values(responses)) {
    if (!(
      typeof v === "string" ||
      (Array.isArray(v) && v.every((x) => typeof x === "string")) ||
      (v &&
        typeof v === "object" &&
        !Array.isArray(v) &&
        Object.values(v).every((x) => typeof x === "string"))
    ))
      throw new Error("Invalid response value.");
  }
  const rows = await query(
    `UPDATE attempts SET responses=$1 WHERE id=$2 AND status='active' AND (deadline IS NULL OR deadline>$3) RETURNING id`,
    [JSON.stringify(responses), a.id, Date.now()],
  );
  if (!rows.length) {
    res.status(409).json({ error: "This attempt has ended." });
    return;
  }
  res.json({ saved: true });
});
app.post("/api/attempts/:id/submit", async (req, res) => {
  const a = await getAttempt(req);
  if (!a) {
    res.status(401).json({ error: "Attempt not found." });
    return;
  }
  if (a.status === "active") await finish(a);
  res.json({ submitted: true });
});
export function answerText(q: Question) {
  if (["multiple", "truefalse", "selection", "checklist"].includes(q.type))
    return q.choices
      .filter((c) => c.correct)
      .map((c) => c.text)
      .join(", ");
  if (["matching", "multimatch"].includes(q.type))
    return q.pairs.map((p) => `${p.left} → ${p.right}`).join("; ");
  if (["list", "listprompt", "statements", "multipart"].includes(q.type))
    return q.pairs
      .map((p) => (q.type === "list" ? p.left : `${p.left} → ${p.right}`))
      .join("; ");
  if (q.type === "table")
    return q.table
      .flat()
      .filter((c) => c.blank)
      .map((c) => c.text)
      .join("; ");
  if (q.type === "ordering") return q.pairs.map((p) => p.left).join(" → ");
  return q.answer;
}
app.get("/api/results", async (_req, res) => {
  res.json(
    await query(
      `SELECT p.code,p.test_id,p.doc->>'title' AS title,p.open,p.created_at,count(a.id)::int AS attempts FROM publications p LEFT JOIN attempts a ON a.code=p.code WHERE p.user_id=$1 GROUP BY p.code ORDER BY p.created_at DESC`,
      [res.locals.user.id],
    ),
  );
});
app.get("/api/results/:code", async (req, res) => {
  const [p] = await query<{ doc: Doc }>(
    "SELECT doc FROM publications WHERE code=$1 AND user_id=$2",
    [req.params.code, res.locals.user.id],
  );
  if (!p) {
    res.status(404).json({ error: "Results not found." });
    return;
  }
  const attempts = await query<Attempt>(
    "SELECT * FROM attempts WHERE code=$1 ORDER BY started DESC",
    [req.params.code],
  );
  for (let i = 0; i < attempts.length; i++) {
    const a = attempts[i];
    if (a.status === "active" && a.deadline && Date.now() >= Number(a.deadline))
      attempts[i] = await finish(a);
  }
  res.json({
    title: p.doc.title,
    attempts: attempts.map(({ token, ...a }) => a),
  });
});
app.put("/api/results/:code/:id/grade", async (req, res) => {
  const [p] = await query(
    "SELECT code FROM publications WHERE code=$1 AND user_id=$2",
    [req.params.code, res.locals.user.id],
  );
  if (!p) {
    res.status(404).json({ error: "Results not found." });
    return;
  }
  const [a] = await query<Attempt>(
    "SELECT * FROM attempts WHERE id=$1 AND code=$2",
    [req.params.id, req.params.code],
  );
  if (!a || a.status !== "submitted")
    throw new Error("Only submitted attempts can be graded.");
  const { questionId, earned, feedback } = req.body;
  const q = a.questions.find((q) => q.id === questionId);
  if (
    !q ||
    typeof earned !== "number" ||
    !Number.isFinite(earned) ||
    earned < 0 ||
    earned > q.marks ||
    typeof feedback !== "string" ||
    feedback.length > 10000
  )
    throw new Error("Enter a mark within the question total.");
  const override = { earned, feedback };
  await transaction(async (tx) => {
    const [current] = await tx<Attempt>(
      "SELECT * FROM attempts WHERE id=$1 FOR UPDATE",
      [a.id],
    );
    await tx(
      "INSERT INTO grade_audit(id,attempt_id,user_id,question_id,change) VALUES($1,$2,$3,$4,$5)",
      [
        crypto.randomUUID(),
        a.id,
        res.locals.user.id,
        questionId,
        JSON.stringify({
          before: current.overrides[questionId] || current.grades[questionId],
          after: override,
        }),
      ],
    );
    await tx(
      "UPDATE attempts SET overrides=jsonb_set(overrides,ARRAY[$1]::text[],$2::jsonb) WHERE id=$3",
      [questionId, JSON.stringify(override), a.id],
    );
  });
  res.json({ ok: true });
});
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "Endpoint not found." }),
);
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const e = err as { issues?: unknown[]; message?: string };
    res.status(400).json({
      error: e.issues
        ? "Some fields are invalid. Please check the question and settings."
        : e.message || "Something went wrong.",
    });
  },
);
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.resolve("dist")));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.resolve("dist/index.html")),
  );
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT) || 3100;
const server = app.listen(port, process.env.HOST || "127.0.0.1", () =>
  console.log(`Classpaper ready: http://localhost:${port}`),
);
process.on("SIGTERM", () => server.close(() => process.exit(0)));
