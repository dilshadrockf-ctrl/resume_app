# ResumeForge

A self-contained resume builder with ATS-aware feedback, targeted job
applications, and career tracking — designed to run **entirely on your
machine**. No cloud accounts, no proprietary extensions, no vendor lock-in.

## What makes it different

- **Local-first, by construction.** Postgres, file storage and the job queue
  all run locally; Redis and S3/MinIO are _options_, not requirements. The app
  works with `REDIS_URL=` (in-process queue) and `STORAGE_DRIVER=filesystem`.
- **AI never invents anything.** Rewrite suggestions only reuse facts already
  in your text; the provider must answer `NO_CHANGE` if it has nothing factual
  to offer, and output that _inflates_ beyond your input is blocked
  server-side. Every suggestion appears as **Original vs Suggested** — nothing
  is ever written to your resume without you accepting it. AI is optional and
  off by default (`AI_PROVIDER=none`).
- **Explainable matching.** Job-match scores come from a deterministic local
  engine: weighted keyword coverage (65%), title alignment (20%), structure
  fit (15%). Every counted term — matched or missing — is shown verbatim from
  the posting. No ATS guarantees are made, because nobody can honestly make
  them.
- **Detailed ATS analysis.** "Check ATS" in the editor runs a local,
  deterministic rules engine (reachability, summary, bullet quality, skills,
  structure, length). Every flagged issue cites what was detected, where, and
  carries a copyable fix — scores are persisted per version, and manual saves
  refresh the latest pass through the job queue.
- **Never lose data.** Autosave with retry/backoff and an explicit
  "save failed — retry" state; version history on every explicit save;
  archiving ≠ deleting; deleting a resume never touches your career profile;
  switching templates preserves content exactly; a failed export can't
  corrupt the editor.
- **Your data leaves in one click.** `/api/account/data` streams a complete
  JSON export (profile, resumes, versions, jobs, matches, applications,
  letters, AI provenance). No dark patterns. Settings also offers a queued
  server-side copy (same JSON, same export machinery), and draft cover letters
  can be re-scaffolded from their job through the queue; the AI bulk pass
  leaves reviewable suggestions, never edits.
- **Billing is dormant.** The plan tables and entitlement checks exist, but
  no payment provider is wired and no fake checkout screens are shipped.

## Quickstart (development)

```bash
npm install
npm run setup        # .env, local postgres, schema, prisma client, seed — all offline
npm run dev          # http://localhost:3000
npm run worker       # optional: dedicated queue worker (in-process queue works without it)
```

`npm run setup` starts an **embedded PostgreSQL** under `.dev/` (no system
service needed), applies the real SQL migrations in `prisma/migrations/`, and
generates the Prisma client with zero engine downloads
(`PRISMA_OFFLINE` + the driver-adapter client). If you already have a
Postgres of your own, set `DATABASE_URL` in `.env` and it will be used
instead.

**Windows and macOS work too:** the embedded-PostgreSQL binaries are
OS-specific _optional_ dependencies, so `npm install` fetches only your
platform's build and skips the rest (no `EBADPLATFORM` errors — just don't
pass `--no-optional`). The quickstart commands above run as-is in both
**PowerShell and cmd.exe** — `npm run setup` is a Node script and its child
`node`/`npx` calls use `cmd.exe` as the shell on Windows. If the embedded
server can't start on your machine, use `docker compose up -d db`
(or any Postgres 16+) and set `DATABASE_URL` in `.env` before running setup.

Windows cmd notes:
- Don't use Posix env-prefix syntax (`PRISMA_OFFLINE=1 npm ...`); use
  `set PRISMA_OFFLINE=1 && npm run db:generate` instead.
- The local `npm run setup` generates `AUTH_SECRET`, so you don't need
  `openssl` for local development.
- For the Docker path, use `copy .env.example .env` (cmd has no `cp`) and set
  `AUTH_SECRET` with:
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Then: `npm run typecheck && npm test` — 23 unit tests cover the matching
engine, cover-letter scaffold, import parser and the AI guardrail.
`npm run test:e2e` runs HTTP smoke checks against a live instance.

## Docker (production-ish, still fully local)

```bash
cp .env.example .env            # set AUTH_SECRET (openssl rand -base64 32)
docker compose up --build
```

Services: `db` (postgres 16), `migrate` (applies `prisma/migrations` and
exits), `app` (Next.js standalone). Optional profile `--profile redis` adds
Redis + a dedicated worker. Everything listens on localhost; nothing calls
home.

## Optional integrations

| Setting                              | Default | Effect when unset                                                        |
| ------------------------------------ | ------- | ------------------------------------------------------------------------ |
| `REDIS_URL`                          | empty   | queue runs in-process (retries/backoff identical, single node)           |
| `S3_ENDPOINT`/`STORAGE_DRIVER=minio` | empty   | files stored on local disk under `FILESYSTEM_STORAGE_DIR`                |
| `MAIL_HOST`                          | empty   | emails logged, never silently dropped from flows                         |
| `AI_PROVIDER`                        | `none`  | AI features show an honest "not configured" state; everything else works |
| `BILLING_ENABLED`                    | `false` | plans are reference data only; no checkout                               |

For AI with a local model (recommended way to try it):

```bash
ollama serve && ollama pull llama3.1
# .env
AI_PROVIDER=ollama
AI_BASE_URL=http://127.0.0.1:11434/v1
AI_DEFAULT_MODEL=llama3.1
```

Any OpenAI-compatible endpoint (LM Studio, vLLM, or hosted, if you opt in)
works via `AI_PROVIDER=openai-compatible`. Fallback providers
(`AI_FALLBACK_*`) are supported; failures in AI paths can never touch saved
content.

## Architecture map

```
src/app/                 routes: public (landing, legal, /resume/[slug]) + (app) workspace
src/features/<domain>/   service (logic) + actions (server-action wrappers, zod-validated)
src/lib/resume/          document schema (zod) — the single source of truth for content
src/templates/           typeset → placed-doc → PDF/DOCX/TXT/HTML renderers (real font metrics)
src/lib/matching.ts      pure local JD→resume scorer with evidence breakdown
src/services/queue.ts    JobRun-backed queue: Redis when configured, in-process otherwise
src/services/storage.ts  filesystem or S3-compatible (MinIO) with signed URLs
src/services/ai/         provider adapters (ollama/openai/anthropic/google), guardrails
src/server/context.ts    auth ctx + audit log for every mutation
prisma/                  schema + real migrations + dev seed (plans; demo user only with SEED_DEMO=1)
tests/                   vitest unit suites (engines + parser + guardrail)
```

Saving contract: the editor autosaves a normalized document; the server
returns a `contentHash`-throttled version list and an `idMap` (temp item ids
→ real library rows) which the client applies without marking dirty. Version
snapshots are self-contained and restorable; restore is non-destructive
(current state becomes a version too).

## Testing & checks

```bash
npm run typecheck     # tsc --noEmit, zero errors
npm test              # vitest run — engines, parser, guardrails
npm run build         # production build (also enforces server-action rules)
npm run test:e2e      # smoke checks against a running instance
```

## Deliberate non-features

- No fabricated testimonials, no fake counters, no "97% ATS pass" claims.
- No payment screens (billing wiring can be added later without schema
  surgery).
- No analytics by default; public resume pages are `noindex` and private
  unless explicitly published.
- No OCR, no cloud AI dependency, no telemetry.
