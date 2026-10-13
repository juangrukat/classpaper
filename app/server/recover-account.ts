import { init, query, closeDatabase } from "./db.js";
import { issueRecovery } from "./accounts.js";
const email = process.argv[2]?.trim().toLowerCase();
if (!email) throw new Error("Usage: npm run recover -- teacher@example.edu");
await init();
const [u] = await query<{ id: string }>(
  "SELECT id FROM users WHERE email=$1 AND disabled=false",
  [email],
);
if (!u) throw new Error("Active account not found.");
const token = await issueRecovery(u.id);
console.log(
  `Single-use recovery link (expires in 30 minutes): ${process.env.PUBLIC_URL || "http://localhost:3100"}/reset?token=${token}`,
);
await closeDatabase();
