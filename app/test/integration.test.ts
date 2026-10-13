import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { defaults, newQuestion } from "../src/domain.js";
test("teacher → publish → save → submit → grade, isolation and retries", async () => {
  const data = await mkdtemp(`${tmpdir()}/classpaper-test-`);
  const port = 3197;
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "server/index.ts"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(port),
        DATA_DIR: data,
        NODE_ENV: "production",
        ALLOW_REGISTRATION: "true",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  child.stdout.on("data", (d) => (output += d));
  child.stderr.on("data", (d) => (output += d));
  const base = `http://127.0.0.1:${port}/api`;
  async function request(
    url: string,
    method = "GET",
    body?: unknown,
    headers: Record<string, string> = {},
  ) {
    const r = await fetch(base + url, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: r.status,
      data: await r.json(),
      cookie: r.headers.get("set-cookie")?.split(";")[0] || "",
    };
  }
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        const r = await fetch(base + "/auth/me");
        if (r.ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    assert(ready, output);
    const teacher = await request("/auth/register", "POST", {
      name: "QA Teacher",
      email: "qa@example.test",
      password: "temporary-test-password",
    });
    assert.equal(teacher.status, 200);
    const teacherHeaders = { Cookie: teacher.cookie };
    const other = await request("/auth/register", "POST", {
      name: "Other Teacher",
      email: "other@example.test",
      password: "temporary-test-password",
    });
    const otherHeaders = { Cookie: other.cookie };
    const q = newQuestion();
    q.text = "Which planet is closest to the Sun?";
    q.notes = "SECRET TEACHER NOTE";
    q.choices = q.choices.slice(0, 2);
    q.choices[0].text = "Mercury";
    q.choices[0].correct = true;
    q.choices[1].text = "Venus";
    const essay = newQuestion("essay");
    essay.text = "Explain your reasoning.";
    essay.answer = "SECRET ESSAY GUIDE";
    essay.marks = 3;
    const doc = {
      title: "Science check",
      description: "Take your time.",
      questions: [q, essay],
      settings: { ...defaults, shuffleChoices: true, accessCode: "class7" },
    };
    const created = await request("/tests", "POST", doc, teacherHeaders);
    assert.equal(created.status, 201);
    const id = created.data.id;
    assert.equal((await request(`/tests/${id}`)).status, 401);
    assert.equal(
      (await request(`/tests/${id}`, "GET", undefined, otherHeaders)).status,
      404,
    );
    const changed = await request(
      `/tests/${id}`,
      "PUT",
      { ...doc, revision: 1 },
      teacherHeaders,
    );
    assert.equal(changed.status, 200);
    assert.equal(
      (
        await request(
          `/tests/${id}`,
          "PUT",
          { ...doc, revision: 1 },
          teacherHeaders,
        )
      ).status,
      409,
    );
    const preset = await request(
      "/presets",
      "POST",
      { name: "Weekly quiz", settings: doc.settings },
      teacherHeaders,
    );
    assert.equal(preset.status, 201);
    assert.equal(
      (await request("/presets", "GET", undefined, otherHeaders)).data.length,
      0,
    );
    const printed = await request(
      `/tests/${id}/print`,
      "POST",
      {},
      teacherHeaders,
    );
    assert.equal(printed.status, 200);
    const version = printed.data.version;
    assert.equal(
      (
        await request(
          `/tests/${id}/print/${version}`,
          "GET",
          undefined,
          teacherHeaders,
        )
      ).data.version,
      version,
    );
    assert.equal(
      (
        await request(
          `/tests/${id}/print/${version}`,
          "GET",
          undefined,
          otherHeaders,
        )
      ).status,
      404,
    );
    const pub = await request(
      `/tests/${id}/publish`,
      "POST",
      {},
      teacherHeaders,
    );
    assert.equal(pub.status, 200);
    const code = pub.data.code;
    assert.equal(
      (
        await request(`/join/${code}`, "POST", {
          name: "Demo Student",
          studentId: "S1",
          accessCode: "wrong",
        })
      ).status,
      403,
    );
    const concurrent = await Promise.all([
      request(`/join/${code}`, "POST", {
        name: "Demo Student",
        studentId: "S1",
        accessCode: "class7",
      }),
      request(`/join/${code}`, "POST", {
        name: "Demo Student",
        studentId: "S1",
        accessCode: "class7",
      }),
    ]);
    assert.deepEqual(concurrent.map((x) => x.status).sort(), [201, 403]);
    const attempt = concurrent.find((x) => x.status === 201)!.data;
    const studentHeaders = { "X-Attempt-Token": attempt.token };
    const view = await request(
      `/attempts/${attempt.id}`,
      "GET",
      undefined,
      studentHeaders,
    );
    assert.equal(view.status, 200);
    assert(!JSON.stringify(view.data).includes("SECRET"));
    assert(!("correct" in view.data.questions[0].choices[0]));
    assert(!("answer" in view.data.questions[1]));
    assert.equal(
      (
        await request(`/attempts/${attempt.id}`, "GET", undefined, {
          "X-Attempt-Token": "wrong",
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await request(
          `/attempts/${attempt.id}/answers`,
          "PUT",
          { responses: { invalid: "wrong" } },
          studentHeaders,
        )
      ).status,
      400,
    );
    const answers = {
      [q.id]: q.choices[0].id,
      [essay.id]: "Mercury has the smallest orbital radius.",
    };
    assert.equal(
      (
        await request(
          `/attempts/${attempt.id}/answers`,
          "PUT",
          { responses: answers },
          studentHeaders,
        )
      ).status,
      200,
    );
    assert.deepEqual(
      (
        await request(
          `/attempts/${attempt.id}`,
          "GET",
          undefined,
          studentHeaders,
        )
      ).data.responses,
      answers,
    );
    // Editing a draft does not alter a publication or active attempt.
    await request(
      `/tests/${id}`,
      "PUT",
      {
        ...doc,
        title: "Changed draft",
        questions: [{ ...q, text: "Changed prompt" }, essay],
        revision: 2,
      },
      teacherHeaders,
    );
    assert.equal(
      (
        await request(
          `/attempts/${attempt.id}`,
          "GET",
          undefined,
          studentHeaders,
        )
      ).data.title,
      "Science check",
    );
    assert.equal(
      (
        await request(
          `/attempts/${attempt.id}/submit`,
          "POST",
          {},
          studentHeaders,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await request(
          `/attempts/${attempt.id}/submit`,
          "POST",
          {},
          studentHeaders,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await request(
          `/tests/${id}/print/${version}`,
          "GET",
          undefined,
          teacherHeaders,
        )
      ).data.title,
      "Science check",
    );
    const done = (
      await request(`/attempts/${attempt.id}`, "GET", undefined, studentHeaders)
    ).data;
    assert.equal(done.result.score, 1);
    assert(done.result.pending);
    assert.equal(done.result.answers, null);
    assert.equal(
      (
        await request(
          `/attempts/${attempt.id}/answers`,
          "PUT",
          { responses: {} },
          studentHeaders,
        )
      ).status,
      409,
    );
    assert.equal(
      (await request(`/results/${code}`, "GET", undefined, otherHeaders))
        .status,
      404,
    );
    const results = await request(
      `/results/${code}`,
      "GET",
      undefined,
      teacherHeaders,
    );
    assert.equal(results.data.attempts.length, 1);
    assert(!("token" in results.data.attempts[0]));
    assert.equal(
      (
        await request(
          `/results/${code}/${attempt.id}/grade`,
          "PUT",
          { questionId: essay.id, earned: 99, feedback: "" },
          teacherHeaders,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await request(
          `/results/${code}/${attempt.id}/grade`,
          "PUT",
          { questionId: essay.id, earned: 2, feedback: "Clear explanation." },
          teacherHeaders,
        )
      ).status,
      200,
    );
    const graded = (
      await request(`/attempts/${attempt.id}`, "GET", undefined, studentHeaders)
    ).data;
    assert.equal(graded.result.score, 3);
    assert.equal(graded.result.pending, false);
    assert.equal(
      (
        await request(
          `/tests/${id}`,
          "PUT",
          { ...doc, revision: 3 },
          { ...teacherHeaders, Origin: "https://different-site.example" },
        )
      ).status,
      403,
    );
    await request(`/tests/${id}`, "DELETE", undefined, teacherHeaders);
    assert.equal((await request(`/join/${code}`)).status, 404);
  } finally {
    child.kill("SIGTERM");
    await new Promise<void>((r) => child.once("exit", () => r()));
    await rm(data, { recursive: true, force: true });
  }
});
