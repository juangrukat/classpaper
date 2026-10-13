import type { Express, RequestHandler } from "express";
import { randomBytes, createHash, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { query, transaction } from "./db.js";
const derive = promisify(scrypt);
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export async function passwordHash(password: string) {
  const salt = randomBytes(32).toString("hex");
  const key = (await derive(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}
export async function passwordMatches(password: string, saved?: string) {
  const [salt, key] = (
    saved || `${randomBytes(32).toString("hex")}:${"0".repeat(128)}`
  ).split(":");
  const actual = (await derive(password, salt, 64)) as Buffer;
  return timingSafeEqual(actual, Buffer.from(key, "hex"));
}
export async function issueRecovery(userId: string) {
  const raw = randomBytes(32).toString("hex");
  await transaction(async (tx) => {
    await tx("DELETE FROM password_resets WHERE user_id=$1", [userId]);
    await tx(
      "INSERT INTO password_resets(token,user_id,expires) VALUES($1,$2,$3)",
      [digest(raw), userId, Date.now() + 30 * 60000],
    );
  });
  return raw;
}
export function accountRoutes(app: Express, auth: RequestHandler) {
  app.post("/api/auth/reset", async (req, res) => {
    const { token, password } = req.body;
    if (
      typeof token !== "string" ||
      token.length !== 64 ||
      typeof password !== "string" ||
      password.length < 10 ||
      password.length > 200
    ) {
      res
        .status(400)
        .json({
          error:
            "Use a valid recovery link and a password of 10–200 characters.",
        });
      return;
    }
    const saved = await passwordHash(password);
    const ok = await transaction(async (tx) => {
      const [reset] = await tx<{ user_id: string }>(
        "DELETE FROM password_resets WHERE token=$1 AND expires>$2 RETURNING user_id",
        [digest(token), Date.now()],
      );
      if (!reset) return false;
      await tx("UPDATE users SET password=$1 WHERE id=$2", [
        saved,
        reset.user_id,
      ]);
      await tx("DELETE FROM sessions WHERE user_id=$1", [reset.user_id]);
      return true;
    });
    if (!ok) {
      res
        .status(400)
        .json({
          error: "This recovery link expired or has already been used.",
        });
      return;
    }
    res.json({ ok: true });
  });
  app.use("/api/admin", auth, (_req, res, next) => {
    if (!res.locals.user.admin) {
      res.status(403).json({ error: "Server administrator access required." });
      return;
    }
    next();
  });
  app.get("/api/admin/users", async (_req, res) =>
    res.json(
      await query(
        "SELECT id,email,name,admin,disabled FROM users ORDER BY email",
      ),
    ),
  );
  app.post("/api/admin/users/:id/recovery", async (req, res) => {
    const [u] = await query(
      "SELECT id FROM users WHERE id=$1 AND disabled=false",
      [req.params.id],
    );
    if (!u) {
      res.status(404).json({ error: "Account not found." });
      return;
    }
    res.json({
      token: await issueRecovery(req.params.id),
      expiresInMinutes: 30,
    });
  });
  app.put("/api/admin/users/:id", async (req, res) => {
    const { disabled } = req.body;
    if (typeof disabled !== "boolean" || req.params.id === res.locals.user.id) {
      res
        .status(400)
        .json({ error: "You cannot disable your own administrator account." });
      return;
    }
    const rows = await transaction(async (tx) => {
      const rows = await tx(
        "UPDATE users SET disabled=$1 WHERE id=$2 RETURNING id",
        [disabled, req.params.id],
      );
      if (disabled)
        await tx("DELETE FROM sessions WHERE user_id=$1", [req.params.id]);
      return rows;
    });
    res
      .status(rows.length ? 200 : 404)
      .json(rows.length ? { ok: true } : { error: "Account not found." });
  });
}
