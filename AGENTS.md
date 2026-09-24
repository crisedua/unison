<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project notes (Unison)

- Stack: Next.js 16 App Router, Supabase (Postgres; no login, the server uses the secret key), OpenAI Responses API with Zod structured outputs, next-intl (EN/ES, cookie-based, no URL prefixes), shadcn/ui (Radix) + Tailwind v4.
- There is no login. `getAppContext()` uses one shared workspace (the oldest, created on first use). The Supabase client uses the secret key, which bypasses RLS, so every Server Action re-checks with `getReadyContext()` that the brand/workspace belongs to that workspace, and every query stays scoped to it. Child tables carry `(brand_id, workspace_id)` with a composite foreign key so rows can't point at another workspace's brand.
- Schema changes go in a new numbered file in `supabase/migrations/`, applied with `npm run db:migrate`. Every table, function and index is prefixed `unison_` (the Supabase project may be shared with other apps). `supabase/setup.sql` is all migrations combined for pasting into the SQL Editor; regenerate it when a migration is added.
- UI text lives in `messages/en.json` and `messages/es.json`; keep both in sync (`npm run check:i18n`). Keys are type-checked against `en.json`.
- AI engine: `src/lib/engine/assets.ts` (output formats + schemas), `prompt.ts` (instructions, Company Brain block, task), `compile.ts` (OpenAI call, error mapping). The Company Brain block is placed before the task so OpenAI's prompt cache can reuse it. The engine never writes when required facts are missing.
- Product name: `src/config/site.ts`. Model: `OPENAI_MODEL` env var.
