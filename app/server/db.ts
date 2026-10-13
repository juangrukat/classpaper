import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { mkdir } from "node:fs/promises";
const dir = process.env.DATA_DIR || "./data";
await mkdir(dir, { recursive: true });
const database = process.env.DATABASE_URL
  ? new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      statement_timeout: 30000,
    })
  : new PGlite(`${dir}/postgres`);
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const r =
    database instanceof PGlite
      ? await database.query(sql, params)
      : await database.query(sql, params);
  return r.rows as T[];
}
export async function init() {
  await query(
    `CREATE TABLE IF NOT EXISTS users(id text PRIMARY KEY,email text UNIQUE NOT NULL,name text NOT NULL,password text NOT NULL);`,
  );
  await query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS admin boolean NOT NULL DEFAULT false`,
  );
  await query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled boolean NOT NULL DEFAULT false`,
  );
  await query(
    `UPDATE users SET admin=true WHERE id=(SELECT id FROM users ORDER BY id LIMIT 1) AND NOT EXISTS (SELECT 1 FROM users WHERE admin=true)`,
  );
  await query(
    `CREATE TABLE IF NOT EXISTS password_resets(token text PRIMARY KEY,user_id text REFERENCES users(id),expires bigint NOT NULL)`,
  );

  await query(
    `CREATE TABLE IF NOT EXISTS sessions(token text PRIMARY KEY,user_id text REFERENCES users(id),expires bigint NOT NULL);`,
  );
  await query(
    `CREATE TABLE IF NOT EXISTS tests(id text PRIMARY KEY,user_id text REFERENCES users(id),doc jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),revision integer NOT NULL DEFAULT 1);`,
  );
  await query(
    `CREATE TABLE IF NOT EXISTS publications(code text PRIMARY KEY,test_id text REFERENCES tests(id),user_id text REFERENCES users(id),doc jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),open boolean NOT NULL DEFAULT true);`,
  );
  await query(
    `CREATE TABLE IF NOT EXISTS attempts(id text PRIMARY KEY,code text REFERENCES publications(code),name text NOT NULL,student_id text NOT NULL,token text UNIQUE NOT NULL,questions jsonb NOT NULL,display jsonb NOT NULL,responses jsonb NOT NULL DEFAULT '{}',started bigint NOT NULL,deadline bigint,status text NOT NULL DEFAULT 'active',grades jsonb NOT NULL DEFAULT '{}',submitted bigint,overrides jsonb NOT NULL DEFAULT '{}');`,
  );
  await query(
    `CREATE TABLE IF NOT EXISTS attempt_recovery(token text PRIMARY KEY,attempt_id text REFERENCES attempts(id),expires bigint NOT NULL)`,
  );
  await query(
    `CREATE TABLE IF NOT EXISTS import_sources(id text PRIMARY KEY,user_id text REFERENCES users(id),name text NOT NULL,data text NOT NULL,created_at timestamptz NOT NULL DEFAULT now())`,
  );
  await query(
    `CREATE TABLE IF NOT EXISTS bank(id text PRIMARY KEY,user_id text REFERENCES users(id),question jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());`,
  );
  await query(
    `CREATE TABLE IF NOT EXISTS presets(id text PRIMARY KEY,user_id text REFERENCES users(id),name text NOT NULL,settings jsonb NOT NULL);`,
  );
  await query(
    `CREATE TABLE IF NOT EXISTS grade_audit(id text PRIMARY KEY,attempt_id text REFERENCES attempts(id),user_id text REFERENCES users(id),question_id text NOT NULL,change jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());`,
  );

  await query(
    `CREATE INDEX IF NOT EXISTS attempts_code_student ON attempts(code,student_id)`,
  );
  await query(`CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS tests_owner ON tests(user_id)`);
  await query(
    `CREATE TABLE IF NOT EXISTS print_versions(version text PRIMARY KEY,test_id text REFERENCES tests(id),user_id text REFERENCES users(id),doc jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());`,
  );
}
export type QueryFn = <T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
) => Promise<T[]>;
export async function transaction<T>(
  work: (q: QueryFn) => Promise<T>,
): Promise<T> {
  if (database instanceof PGlite)
    return database.transaction(async (tx) =>
      work(async <R>(sql: string, params: unknown[] = []) => {
        const r = await tx.query(sql, params);
        return r.rows as R[];
      }),
    );
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const value = await work(async <R>(sql: string, params: unknown[] = []) => {
      const r = await client.query(sql, params);
      return r.rows as R[];
    });
    await client.query("COMMIT");
    return value;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function closeDatabase() {
  if (database instanceof PGlite) await database.close();
  else await database.end();
}
