import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const base = process.env.VERIFY_URL || "http://localhost:3312",
  state = JSON.parse(await readFile("./data/deployment-qa.json", "utf8"));
async function request(
  url: string,
  method = "GET",
  body?: unknown,
  headers: Record<string, string> = {},
) {
  const r = await fetch(base + "/api" + url, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  assert(r.ok, `${url}: ${r.status}`);
  return data;
}
const started = Date.now();
const joins = await Promise.all(
  Array.from({ length: 50 }, (_, i) =>
    request(`/join/${state.code}`, "POST", {
      name: `Load QA ${i + 1}`,
      studentId: `load-${started}-${i}`,
    }),
  ),
);
await Promise.all(
  joins.map((j) =>
    request(
      `/attempts/${j.id}/answers`,
      "PUT",
      { responses: { [state.essayId]: "Synthetic classroom answer." } },
      { "X-Attempt-Token": j.token },
    ),
  ),
);
await Promise.all(
  joins.map((j) =>
    request(
      `/attempts/${j.id}/submit`,
      "POST",
      {},
      { "X-Attempt-Token": j.token },
    ),
  ),
);
const report = {
  students: 50,
  parallelStartSaveSubmit: true,
  failedRequests: 0,
  elapsedMs: Date.now() - started,
  environment: "Podman ARM64, PostgreSQL 17, app memory cap 1 GB",
};
await writeFile(
  "../docs/production/evidence/load-check.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
