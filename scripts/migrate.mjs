// Applies supabase/migrations/*.sql to DATABASE_URL, in order, once each.
// Usage: npm run db:migrate
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "DATABASE_URL is missing. Add the Supabase “Session pooler” connection string to .env.local.",
  );
  process.exit(1);
}

const sql = postgres(url, {
  max: 1,
  ssl: process.env.DATABASE_SSL === "false" ? false : "require",
  onnotice: () => {},
});

const dir = path.join(process.cwd(), "supabase", "migrations");

try {
  await sql`create schema if not exists app_private`;
  await sql`
    create table if not exists app_private.unison_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )`;

  const applied = new Set(
    (await sql`select name from app_private.unison_migrations`).map((row) => row.name),
  );
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const pending = files.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log("Database is up to date.");
  }

  for (const file of pending) {
    const body = await readFile(path.join(dir, file), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into app_private.unison_migrations (name) values (${file})`;
    });
    console.log(`Applied ${file}`);
  }
} catch (error) {
  console.error(`Migration failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
