import type { Express, RequestHandler } from "express";
import { randomBytes } from "node:crypto";
import { digest } from "./accounts.js";
import { query, transaction } from "./db.js";
export function classroomRoutes(app: Express, auth: RequestHandler) {
  app.post("/api/join/recover", async (req, res) => {
    const raw = req.body.recoveryCode;
    if (typeof raw !== "string" || raw.length !== 64) {
      res
        .status(400)
        .json({ error: "Enter the recovery code your teacher gave you." });
      return;
    }
    const token = randomBytes(32).toString("hex");
    const row = await transaction(async (tx) => {
      const [r] = await tx<{ attempt_id: string }>(
        "DELETE FROM attempt_recovery WHERE token=$1 AND expires>$2 AND attempt_id IN (SELECT id FROM attempts WHERE code=$3) RETURNING attempt_id",
        [digest(raw), Date.now(), req.body.code],
      );
      if (!r) return null;
      const [a] = await tx<{ id: string; code: string }>(
        "UPDATE attempts SET token=$1 WHERE id=$2 AND status='active' AND (deadline IS NULL OR deadline>$3) RETURNING id,code",
        [digest(token), r.attempt_id, Date.now()],
      );
      return a;
    });
    if (!row) {
      res
        .status(400)
        .json({
          error: "This recovery code expired, was used, or the attempt ended.",
        });
      return;
    }
    res.json({ ...row, token });
  });
  app.post("/api/results/:code/:id/extend", auth, async (req, res) => {
    const minutes = req.body.minutes;
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 120) {
      res.status(400).json({ error: "Choose 1–120 additional minutes." });
      return;
    }
    const rows = await query(
      `UPDATE attempts a SET deadline=GREATEST(COALESCE(deadline,$1),$1)+$2 WHERE a.id=$3 AND a.code=$4 AND a.status='active' AND a.deadline IS NOT NULL AND EXISTS(SELECT 1 FROM publications p WHERE p.code=a.code AND p.user_id=$5) RETURNING deadline`,
      [
        Date.now(),
        minutes * 60000,
        req.params.id,
        req.params.code,
        res.locals.user.id,
      ],
    );
    res
      .status(rows.length ? 200 : 404)
      .json(
        rows.length
          ? rows[0]
          : {
              error:
                "Active attempt not found. Submitted attempts cannot be extended.",
            },
      );
  });
  app.post("/api/results/:code/:id/recovery", auth, async (req, res) => {
    const raw = randomBytes(32).toString("hex");
    const ok = await transaction(async (tx) => {
      const [a] = await tx(
        `SELECT a.id FROM attempts a JOIN publications p ON a.code=p.code WHERE a.id=$1 AND a.code=$2 AND p.user_id=$3 AND a.status='active' AND (a.deadline IS NULL OR a.deadline>$4) FOR UPDATE OF a`,
        [req.params.id, req.params.code, res.locals.user.id, Date.now()],
      );
      if (!a) return false;
      await tx("DELETE FROM attempt_recovery WHERE attempt_id=$1", [
        req.params.id,
      ]);
      await tx(
        "INSERT INTO attempt_recovery(token,attempt_id,expires) VALUES($1,$2,$3)",
        [digest(raw), req.params.id, Date.now() + 15 * 60000],
      );
      return true;
    });
    res
      .status(ok ? 200 : 404)
      .json(
        ok
          ? { recoveryCode: raw, expiresInMinutes: 15 }
          : { error: "Active attempt not found." },
      );
  });
  app.get("/api/results/:code/statistics", auth, async (req, res) => {
    const [p] = await query(
      "SELECT code FROM publications WHERE code=$1 AND user_id=$2",
      [req.params.code, res.locals.user.id],
    );
    if (!p) {
      res.status(404).json({ error: "Results not found." });
      return;
    }
    const attempts = await query<{
      questions: { id: string; text: string; marks: number }[];
      grades: Record<string, { earned: number; manual: boolean }>;
      overrides: Record<string, { earned: number }>;
    }>(
      "SELECT questions,grades,overrides FROM attempts WHERE code=$1 AND status='submitted'",
      [req.params.code],
    );
    const items = new Map<
      string,
      {
        id: string;
        text: string;
        responses: number;
        graded: number;
        pending: number;
        earned: number;
        possible: number;
      }
    >();
    for (const a of attempts)
      for (const q of a.questions) {
        const row = items.get(q.id) || {
          id: q.id,
          text: q.text,
          responses: 0,
          graded: 0,
          pending: 0,
          earned: 0,
          possible: 0,
        };
        row.responses++;
        if (a.grades[q.id]?.manual && !a.overrides[q.id]) row.pending++;
        else {
          row.graded++;
          row.earned +=
            a.overrides[q.id]?.earned ?? a.grades[q.id]?.earned ?? 0;
          row.possible += q.marks;
        }
        items.set(q.id, row);
      }
    res.json(
      [...items.values()].map((r) => ({
        ...r,
        percent: r.possible ? Math.round((100 * r.earned) / r.possible) : null,
      })),
    );
  });
}
