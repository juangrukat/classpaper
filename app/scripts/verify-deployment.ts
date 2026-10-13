import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { defaults, newQuestion } from "../src/domain.js";
const base = process.env.VERIFY_URL || "http://localhost:3310";
const stateFile = "./data/deployment-qa.json";
async function req(
  url: string,
  method = "GET",
  body?: unknown,
  cookie = "",
  headers: Record<string, string> = {},
) {
  const r = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const d = r.headers.get("content-type")?.includes("json")
    ? await r.json()
    : Buffer.from(await r.arrayBuffer());
  assert(
    r.ok,
    `${method} ${url}: ${r.status} ${JSON.stringify(d).slice(0, 300)}`,
  );
  return { data: d, cookie: r.headers.get("set-cookie")?.split(";")[0] || "" };
}
await req("/health/ready");
if (process.env.VERIFY_RESTORE === "true") {
  const s = JSON.parse(await readFile(stateFile, "utf8"));
  const login = await req("/api/auth/login", "POST", {
    email: s.email,
    password: s.password,
  });
  const test = await req(
    `/api/tests/${s.testId}`,
    "GET",
    undefined,
    login.cookie,
  );
  assert.equal(test.data.title, s.title);
  const results = await req(
    `/api/results/${s.code}`,
    "GET",
    undefined,
    login.cookie,
  );
  const restored=results.data.attempts.find((a:{status:string;overrides:Record<string,{earned:number}>})=>a.status==="submitted"&&a.overrides[s.essayId]?.earned===2);
  assert(restored,"Expected restored teacher grade");
  assert.equal(
    (
      await req(
        `/api/import/sources/${s.sourceId}`,
        "GET",
        undefined,
        login.cookie,
      )
    ).data.toString(),
    s.source,
  );
  assert.equal(
    (
      await req(
        `/api/tests/${s.testId}/print/${s.version}`,
        "GET",
        undefined,
        login.cookie,
      )
    ).data.version,
    s.version,
  );
  console.log(
    JSON.stringify({
      restored: true,
      test: true,
      attempt: true,
      grade: true,
      source: true,
      printVersion: true,
    }),
  );
} else {
  const email = `deployment-${Date.now()}@qa.invalid`,
    password = randomBytes(24).toString("hex");
  const account = await req("/api/auth/register", "POST", {
      name: "Deployment QA",
      email,
      password,
    }),
    cookie = account.cookie;
  const q = newQuestion();
  q.text = "Which planet is closest?";
  q.choices = q.choices.slice(0, 2);
  q.choices[0].text = "Mercury";
  q.choices[0].correct = true;
  q.choices[1].text = "Venus";
  const essay = newQuestion("essay");
  essay.text = "Explain day and night";
  essay.marks = 3;
  essay.answer = "Earth rotation.";
  const title = "Deployment and restore QA";
  const test = await req(
    "/api/tests",
    "POST",
    {
      title,
      description: "Fictional deployment verification",
      questions: [q, essay],
      settings: { ...defaults },
    },
    cookie,
  );
  const testId = test.data.id;
  const published = await req(
      `/api/tests/${testId}/publish`,
      "POST",
      {},
      cookie,
    ),
    code = published.data.code;
  const join = await req(`/api/join/${code}`, "POST", {
    name: "Synthetic Student",
    studentId: "QA-01",
  });
  const headers = { "X-Attempt-Token": join.data.token };
  await req(
    `/api/attempts/${join.data.id}/answers`,
    "PUT",
    { responses: { [q.id]: q.choices[0].id, [essay.id]: "Earth rotates." } },
    "",
    headers,
  );
  await req(`/api/attempts/${join.data.id}/submit`, "POST", {}, "", headers);
  await req(
    `/api/results/${code}/${join.data.id}/grade`,
    "PUT",
    { questionId: essay.id, earned: 2, feedback: "QA feedback" },
    cookie,
  );
  const results = await req(`/api/results/${code}`, "GET", undefined, cookie);
  assert.equal(results.data.attempts[0].grades[q.id].earned, 1);
  const source = "Aiken sample?\nA. Yes\nB. No\nANSWER: A";
  const imported = await req(
    "/api/import",
    "POST",
    { name: "qa.aiken", data: Buffer.from(source).toString("base64") },
    cookie,
  );
  assert.equal(imported.data.questions.length, 1);
  await req(
    "/api/presets",
    "POST",
    { name: "QA exam preset", settings: { ...defaults, titleStyle: "exam" } },
    cookie,
  );
  const print = await req(`/api/tests/${testId}/print`, "POST", {}, cookie);
  const version = print.data.version;
  const pdf = await req(
    `/api/tests/${testId}/pdf/${version}`,
    "GET",
    undefined,
    cookie,
  );
  assert.equal(pdf.data.subarray(0, 5).toString(), "%PDF-");
  await writeFile("../docs/production/evidence/container-print.pdf", pdf.data);
  await mkdir("./data", { recursive: true });
  await writeFile(
    stateFile,
    JSON.stringify({
      email,
      password,
      testId,
      title,
      code,
      essayId: essay.id,
      source,
      sourceId: imported.data.sourceId,
      version,
    }),
  );
  console.log(
    JSON.stringify({
      container: true,
      postgres: true,
      publication: true,
      submission: true,
      manualGrade: true,
      source: true,
      preset: true,
      savedPrint: true,
      pdfBytes: pdf.data.length,
    }),
  );
}
