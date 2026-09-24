# Unison

Your company's memory for marketing and sales. Describe the business once in the **Company Brain**. Every blog post, email, LinkedIn post, video script, Instagram Reel and Meta ad is then written from it, in English or Spanish, and shows which facts it used.

## What's built (phase 1)

- **No login.** Everyone who opens the app works in one shared workspace. Anyone with the URL can read and edit everything, so keep the URL private.
- **Company Brain.**
  - Seven fields: what you do, audience, problem, positioning, offer, proof, and brand voice.
  - Notes and uploaded files (PDF, Word, TXT, Markdown).
  - A "facts remembered" meter showing what's still missing.
- **Content Studio.** One idea, or one of your documents, becomes a finished set. For each set you pick:
  - which pieces to write
  - the length
  - a tone layered on top of your brand voice
  - the language: US or UK English; Spanish for Latin America, Mexico or Spain
  - It won't write until the facts it needs are filled in.
- **Library.** Every set is saved automatically. Any piece can be saved as an editable draft, copied, or downloaded.
- **Brands.** One account can hold several brands, each with its own brain. This is useful for a second business or for clients.
- **English and Spanish interface.** Toggle with EN / ES.

## Setup (about 15 minutes)

### 1. Supabase (database)

1. Create a free project at [supabase.com](https://supabase.com). Save the database password you choose.
2. Click **Connect** at the top of the dashboard.
   - Copy the project URL. This is `NEXT_PUBLIC_SUPABASE_URL`.
   - Under Project Settings → API Keys, copy the **secret** key (older projects: `service_role`). This is `SUPABASE_SECRET_KEY`. It stays on the server; never paste it into browser code.
3. In the same **Connect** window, under **Connection string**, copy the **Session pooler** URI.
   - Replace `[YOUR-PASSWORD]` with your database password.
   - This is your `DATABASE_URL`.

### 2. OpenAI (the writing)

1. Create an API key at [platform.openai.com](https://platform.openai.com/api-keys).
2. Make sure the account has billing or credit set up.

### 3. Add the keys

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

### 4. Create the database tables

```bash
npm run db:migrate
```

### 5. Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You land straight in the Company Brain.

## Common changes

| Change | Where |
|---|---|
| Product name | `src/config/site.ts` |
| AI model | `OPENAI_MODEL` in `.env.local`. `gpt-6-sol` is the default; `gpt-6-astra` is the flagship at about 5× the cost |
| How hard the model thinks | `OPENAI_REASONING_EFFORT` (`low` … `max`) in `.env.local` |
| Interface text | `messages/en.json` and `messages/es.json`, then run `npm run check:i18n` to confirm both files have the same keys |
| What the AI is told | `src/lib/engine/prompt.ts` |
| Output formats (add one here) | `src/lib/engine/assets.ts`, plus its rules in `prompt.ts` |

## How it's organized

```
src/
  app/(app)/brain      Company Brain screen and its save/upload actions
  app/(app)/studio     Content Studio and the "write the set" action
  app/(app)/library    Saved sets and drafts
  app/(app)/drafts     Draft editor
  lib/engine           AI engine: output formats, prompt, OpenAI call
  lib/brain            Company Brain facts and queries
  components/          Shared UI (app shell, content set view, shadcn/ui)
supabase/migrations    Database schema, including the security rules that keep each workspace's data private
messages/              English and Spanish interface text
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the app locally |
| `npm run build` | Production build |
| `npm run db:migrate` | Apply new database migrations |
| `npm run typecheck` / `npm run lint` | Code checks |
| `npm run check:i18n` | Confirm English and Spanish text have the same keys |

## Roadmap

1. **Phase 1** (done): Company Brain, Content Studio, Library, English and Spanish.
2. **Phase 2:** Campaign Studio, which turns a goal into angles, A/B variants, a test plan and a launch plan. Sales briefs. Results & analysis.
3. **Phase 3:** Landing page, Free/Pro/Team plans with Stripe, a real email provider, team seats.
4. **Phase 4:**
   - Instagram Reels: script, then video, then publishing.
   - Meta Ads: create ads as paused drafts and pull results back into Results & analysis.
