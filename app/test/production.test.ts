import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  defaults,
  newQuestion,
  grade,
  publicQuestion,
  materialize,
  errorsFor,
} from "../src/domain.js";
import { readFile, readCsv } from "../server/interchange.js";
import { readAiken, exportCsv } from "../server/spreadsheet.js";
test("multi-blank choices conceal keys and require every correct answer", () => {
  const q = newQuestion("selection");
  q.text = "The ___ orbits the ___.";
  q.selections = ["Earth", "Sun"].map((text) => ({
    id: crypto.randomUUID(),
    choices: [
      { id: crypto.randomUUID(), text, correct: true, locked: false },
      { id: crypto.randomUUID(), text: "Moon", correct: false, locked: false },
    ],
  }));
  assert.deepEqual(errorsFor(q), []);
  assert.equal(
    grade(
      q,
      Object.fromEntries(q.selections.map((s) => [s.id, s.choices[0].id])),
    ).earned,
    1,
  );
  assert.equal(grade(q, {}).earned, 0);
  assert(!JSON.stringify(publicQuestion(q)).includes("correct"));
  assert.equal(publicQuestion(q).selections.length, 2);
  q.text = "Only ___";
  assert(errorsFor(q).length);
});
test("within-group shuffle preserves group positions and all identities", () => {
  const qs = Array.from({ length: 6 }, (_, i) => ({
    ...newQuestion(),
    text: String(i),
    group: i < 3 ? "A" : "B",
  }));
  for (let i = 0; i < 10; i++) {
    const out = materialize(qs, { ...defaults, shuffleWithinGroups: true });
    assert(out.slice(0, 3).every((q) => q.group === "A"));
    assert(out.slice(3).every((q) => q.group === "B"));
    assert.equal(new Set(out.map((q) => q.id)).size, 6);
  }
});
test("Aiken rejects invalid keys; CSV round-trips correct answers and numerical tolerance", async () => {
  const r = readAiken(
    "Closest planet?\nA. Mercury\nB. Venus\nANSWER: A\n\nBad?\nA. Yes\nB. No\nANSWER: Z",
  );
  assert.equal(r.questions.length, 1);
  assert.equal(r.errors.length, 1);
  assert.equal(
    (
      await readFile(
        "questions.aiken",
        Buffer.from("Closest?\nA) Mercury\nB) Venus\nANSWER: A"),
      )
    ).questions.length,
    1,
  );
  const tf = newQuestion("truefalse");
  tf.text = "True statement";
  tf.choices[0].correct = true;
  const n = newQuestion("numerical");
  n.text = "Approximate";
  n.answer = "-3.14";
  n.tolerance = 0.02;
  const out = readCsv(
    exportCsv([...r.questions, tf, n]).text.replace(/^\uFEFF/, ""),
  );
  assert.deepEqual(out.errors, []);
  assert.equal(out.questions[1].choices[0].correct, true);
  assert.equal(out.questions[2].tolerance, 0.02);
  assert.equal(out.questions[2].answer, "-3.14");
  const formula = { ...n, text: "=HYPERLINK(unsafe)" };
  const safe = exportCsv([formula]);
  assert(safe.warnings.some((w) => w.includes("formula")));
  assert(safe.text.includes("\"'="));
});
test("production operations: accounts, recovery, archive, extensions, part grading, statistics and PDFs", async () => {
  const dir = await mkdtemp(`${tmpdir()}/classpaper-production-`),
    port = 3198;
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "server/index.ts"],
    {
      env: {
        ...process.env,
        DATABASE_URL: "",
        PORT: String(port),
        DATA_DIR: dir,
        NODE_ENV: "production",
        ALLOW_REGISTRATION: "true",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  child.stdout.on("data", (d) => (output += d));
  child.stderr.on("data", (d) => (output += d));
  const base = `http://127.0.0.1:${port}`;
  async function call(
    url: string,
    method = "GET",
    body?: unknown,
    cookie = "",
    extra: Record<string, string> = {},
  ) {
    const r = await fetch(base + url, {
      method,
      headers: { "Content-Type": "application/json", Cookie: cookie, ...extra },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: r.status,
      data: r.headers.get("content-type")?.includes("json")
        ? await r.json()
        : Buffer.from(await r.arrayBuffer()),
      cookie: r.headers.get("set-cookie")?.split(";")[0] || "",
      headers: r.headers,
    };
  }
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(base + "/health/ready")).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    assert(ready, output);
    const admin = await call("/api/auth/register", "POST", {
        name: "Admin",
        email: "admin@qa.test",
        password: "disposable-test-password",
      }),
      teacher = await call("/api/auth/register", "POST", {
        name: "Teacher",
        email: "teacher@qa.test",
        password: "disposable-test-password",
      });
    assert.equal(admin.status, 200);
    assert.equal(
      (await call("/api/auth/me", "GET", undefined, admin.cookie)).data.user
        .admin,
      true,
    );
    assert.equal(
      (await call("/api/admin/users", "GET", undefined, teacher.cookie)).status,
      403,
    );
    const reset = await call(
      `/api/admin/users/${teacher.data.user.id}/recovery`,
      "POST",
      {},
      admin.cookie,
    );
    assert.equal(reset.status, 200);
    assert.equal(
      (
        await call("/api/auth/reset", "POST", {
          token: reset.data.token,
          password: "replacement-test-password",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await call("/api/auth/reset", "POST", {
          token: reset.data.token,
          password: "replacement-test-password",
        })
      ).status,
      400,
    );
    assert.equal(
      (await call("/api/tests", "GET", undefined, teacher.cookie)).status,
      401,
    );
    const t = await call("/api/auth/login", "POST", {
      email: "teacher@qa.test",
      password: "replacement-test-password",
    });
    assert.equal(t.status, 200);
    await call(
      `/api/admin/users/${teacher.data.user.id}`,
      "PUT",
      { disabled: true },
      admin.cookie,
    );
    assert.equal(
      (
        await call("/api/auth/login", "POST", {
          email: "teacher@qa.test",
          password: "replacement-test-password",
        })
      ).status,
      401,
    );
    assert.equal(
      (await call("/api/tests", "GET", undefined, t.cookie)).status,
      401,
    );
    assert.equal(
      (
        await call(
          `/api/admin/users/${admin.data.user.id}`,
          "PUT",
          { disabled: true },
          admin.cookie,
        )
      ).status,
      400,
    );
    await call(
      `/api/admin/users/${teacher.data.user.id}`,
      "PUT",
      { disabled: false },
      admin.cookie,
    );
    const source = "Closest? {=Mercury ~Venus}",
      imported = await call(
        "/api/import",
        "POST",
        { name: "source.gift", data: Buffer.from(source).toString("base64") },
        admin.cookie,
      );
    assert.equal(imported.data.questions.length, 1);
    assert.equal(
      (
        await call(
          `/api/import/sources/${imported.data.sourceId}`,
          "GET",
          undefined,
          admin.cookie,
        )
      ).data.toString(),
      source,
    );
    const t2 = await call("/api/auth/login", "POST", {
      email: "teacher@qa.test",
      password: "replacement-test-password",
    });
    assert.equal(
      (
        await call(
          `/api/import/sources/${imported.data.sourceId}`,
          "GET",
          undefined,
          t2.cookie,
        )
      ).status,
      404,
    );
    const part = newQuestion("multipart");
    part.text = "Explain two facts";
    part.pairs = [
      { id: "p1", left: "First", right: "Guide one", marks: 2 },
      { id: "p2", left: "Second", right: "Guide two", marks: 3 },
    ];
    part.marks = 5;
    const doc = {
      title: "Operational check",
      description: "Fictional QA",
      questions: [part],
      settings: { ...defaults, timeLimit: 1, feedback: "answers" },
    };
    const created = await call("/api/tests", "POST", doc, admin.cookie);
    assert.equal(created.status, 201);
    const shared = await call(
        `/api/tests/${created.data.id}/publish`,
        "POST",
        {},
        admin.cookie,
      ),
      code = shared.data.code;
    assert.equal(shared.status, 200);
    const joined = await call(`/api/join/${code}`, "POST", {
      name: "QA Student",
      studentId: "one",
    });
    assert.equal(joined.status, 201);
    const ah = { "X-Attempt-Token": joined.data.token };
    const attempt = await call(
      `/api/attempts/${joined.data.id}`,
      "GET",
      undefined,
      "",
      ah,
    );
    const extended = await call(
      `/api/results/${code}/${joined.data.id}/extend`,
      "POST",
      { minutes: 15 },
      admin.cookie,
    );
    assert.equal(extended.status, 200);
    assert(Number(extended.data.deadline) > Number(attempt.data.deadline));
    assert.equal(
      (
        await call(
          `/api/results/${code}/${joined.data.id}/extend`,
          "POST",
          { minutes: 999 },
          admin.cookie,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await call(
          `/api/results/${code}/${joined.data.id}/extend`,
          "POST",
          { minutes: 15 },
          t2.cookie,
        )
      ).status,
      404,
    );
    await call(
      `/api/attempts/${joined.data.id}/answers`,
      "PUT",
      { responses: { [part.id]: { p1: "One", p2: "Two" } } },
      "",
      ah,
    );
    const recovery = await call(
      `/api/results/${code}/${joined.data.id}/recovery`,
      "POST",
      {},
      admin.cookie,
    );
    assert.equal(recovery.status, 200);
    assert.equal(
      (
        await call("/api/join/recover", "POST", {
          code: "wrong-test",
          recoveryCode: recovery.data.recoveryCode,
        })
      ).status,
      400,
    );
    const recovered = await call("/api/join/recover", "POST", {
      code,
      recoveryCode: recovery.data.recoveryCode,
    });
    assert.equal(recovered.status, 200);
    assert.equal(
      (
        await call("/api/join/recover", "POST", {
          code,
          recoveryCode: recovery.data.recoveryCode,
        })
      ).status,
      400,
    );
    assert.equal(
      (await call(`/api/attempts/${joined.data.id}`, "GET", undefined, "", ah))
        .status,
      401,
    );
    const nh = { "X-Attempt-Token": recovered.data.token },
      resumed = await call(
        `/api/attempts/${joined.data.id}`,
        "GET",
        undefined,
        "",
        nh,
      );
    assert.equal(resumed.data.responses[part.id].p1, "One");
    assert(!JSON.stringify(resumed.data).includes("Guide one"));
    await call(`/api/attempts/${joined.data.id}/submit`, "POST", {}, "", nh);
    const route = `/api/results/${code}/${joined.data.id}/grade`;
    assert.equal(
      (
        await call(
          route,
          "PUT",
          {
            questionId: part.id,
            earned: 4,
            feedback: "Good",
            parts: { p1: 2, p2: 2 },
          },
          admin.cookie,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await call(
          route,
          "PUT",
          {
            questionId: part.id,
            earned: 5,
            feedback: "Bad",
            parts: { p1: 4, p2: 1 },
          },
          admin.cookie,
        )
      ).status,
      400,
    );
    const stats = await call(
      `/api/results/${code}/statistics`,
      "GET",
      undefined,
      admin.cookie,
    );
    assert.equal(stats.data[0].percent, 80);
    assert.equal(stats.data[0].pending, 0);
    assert.equal(
      (
        await call(
          `/api/results/${code}/${joined.data.id}/extend`,
          "POST",
          { minutes: 15 },
          admin.cookie,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await call("/api/tests", "POST", doc, admin.cookie, {
          "Sec-Fetch-Site": "cross-site",
        })
      ).status,
      403,
    );
    assert(
      (await call("/api/auth/me")).headers
        .get("content-security-policy")
        ?.includes("frame-ancestors 'none'"),
    );
    const print = await call(
      `/api/tests/${created.data.id}/print`,
      "POST",
      {},
      admin.cookie,
    );
    assert.equal(
      (await call(`/api/tests/${created.data.id}/pdf/${print.data.version}`))
        .status,
      401,
    );
    if (process.env.CHROMIUM_PATH) {
      for (const paper of ["A4", "Letter"] as const)
        for (const columns of [1, 2]) {
          const qs = Array.from({ length: 45 }, (_, i) => ({
            ...newQuestion("essay"),
            text: `Question ${i + 1}. Explain a classroom example in detail.`,
            marks: 2,
          }));
          const large = await call(
            "/api/tests",
            "POST",
            {
              ...doc,
              title: `Print QA ${paper} ${columns}`,
              questions: qs,
              settings: {
                ...defaults,
                paper,
                columns,
                titleStyle: "exam",
                sheetStyle: columns === 2 ? "compact" : "lined",
              },
            },
            admin.cookie,
          );
          const snapshot = await call(
              `/api/tests/${large.data.id}/print`,
              "POST",
              {},
              admin.cookie,
            ),
            url = `/api/tests/${large.data.id}/pdf/${snapshot.data.version}`;
          const pdf = await call(
            url + "?mode=test",
            "GET",
            undefined,
            admin.cookie,
          );
          assert.equal(pdf.status, 200, JSON.stringify(pdf.data));
          assert.equal(pdf.data.subarray(0, 5).toString(), "%PDF-");
          assert(
            (pdf.data.toString("latin1").match(/\/Type\s*\/Page\b/g) || [])
              .length >= 2,
          );
          assert.deepEqual(
            (await call(url + "?check=1", "GET", undefined, admin.cookie)).data
              .warnings,
            [],
          );
          const sheet = await call(
            url + "?mode=sheet",
            "GET",
            undefined,
            admin.cookie,
          );
          assert.equal(sheet.status, 200);
          assert.equal(sheet.data.subarray(0, 5).toString(), "%PDF-");
          const key = await call(
            url + "?mode=key",
            "GET",
            undefined,
            admin.cookie,
          );
          assert.equal(key.status, 200);
          assert.equal(key.data.subarray(0, 5).toString(), "%PDF-");
          if (process.env.PDF_EVIDENCE_DIR)
            await writeFile(
              `${process.env.PDF_EVIDENCE_DIR}/${paper}-${columns}.pdf`,
              pdf.data,
            );
        }
      const huge = {
        ...newQuestion("essay"),
        text: "An intentionally oversized block ".repeat(500),
      };
      const oversized = await call(
        "/api/tests",
        "POST",
        {
          ...doc,
          title: "Overflow check",
          questions: [huge],
          settings: defaults,
        },
        admin.cookie,
      );
      const snap = await call(
        `/api/tests/${oversized.data.id}/print`,
        "POST",
        {},
        admin.cookie,
      );
      const checked = await call(
        `/api/tests/${oversized.data.id}/pdf/${snap.data.version}?check=1`,
        "GET",
        undefined,
        admin.cookie,
      );
      assert.equal(checked.status, 200);
      assert(checked.data.warnings.some((w: string) => w.includes("taller")));
    } else
      assert.equal(
        (
          await call(
            `/api/tests/${created.data.id}/pdf/${print.data.version}`,
            "GET",
            undefined,
            admin.cookie,
          )
        ).status,
        503,
      );
  } finally {
    child.kill("SIGTERM");
    await new Promise<void>((r) => child.once("exit", () => r()));
    await rm(dir, { recursive: true, force: true });
  }
});
