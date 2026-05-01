# Local Setup Guide

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| [Bun](https://bun.sh) | ≥ 1.3 | `curl -fsSL https://bun.sh/install \| bash` |
| [PostgreSQL](https://www.postgresql.org/download/) | ≥ 14 | `brew install postgresql@16` |

You also need an **Anthropic API key** — get one at [console.anthropic.com](https://console.anthropic.com).

---

## 1. Install dependencies

```bash
bun install
```

---

## 2. Configure environment variables

### Server (`apps/server/.env`)

This file already exists in the repo. Open it and fill in the two required values:

```env
# Paste your Anthropic key here
ANTHROPIC_API_KEY=sk-ant-...

# Your local Postgres connection string
DATABASE_URL=postgres://postgres:postgres@localhost:5432/healosbench

# Generate a secret: openssl rand -base64 32
BETTER_AUTH_SECRET=<32+ character random string>

# Leave these as-is for local dev
BETTER_AUTH_URL=http://localhost:8787
CORS_ORIGIN=http://localhost:3001
NODE_ENV=development
PORT=8787
```

Generate a secure `BETTER_AUTH_SECRET`:
```bash
openssl rand -base64 32
```

### Web (`apps/web/.env.local`)

This file already exists and is pre-configured — no changes needed:

```env
NEXT_PUBLIC_SERVER_URL=http://localhost:8787
```

---

## 3. Set up the database

Create the database (skip if it already exists):

```bash
psql -U postgres -c "CREATE DATABASE healosbench;"
```

Push the schema:

```bash
bun db:push
```

This creates all tables (`runs`, `case_results`, `user`, `session`, `account`, `verification`).

---

## 4. Start the application

Run both the API server and the web app together:

```bash
bun dev
```

Or start them individually in separate terminals:

```bash
# Terminal 1 — API server (http://localhost:8787)
bun dev:server

# Terminal 2 — Web app (http://localhost:3001)
bun dev:web
```

Open **http://localhost:3001** in your browser.

---

## 5. Run an eval

### Via the web UI

1. Go to **http://localhost:3001/runs**
2. Select a strategy (Zero Shot / Few Shot / Chain of Thought)
3. Click **Start Run**
4. Watch progress update in real time

### Via the CLI

```bash
bun eval --strategy=zero_shot
bun eval --strategy=few_shot
bun eval --strategy=cot
```

Optional flags:
```bash
--model=claude-haiku-4-5-20251001   # default model
--strategy=zero_shot|few_shot|cot   # extraction strategy
```

---

## 6. Compare runs

Go to **http://localhost:3001/compare**, select two completed runs, and click **Compare** to see a per-field F1 breakdown.

---

## Ports at a glance

| Service | URL |
|---------|-----|
| Web (Next.js) | http://localhost:3001 |
| API (Hono) | http://localhost:8787 |
| DB Studio | `bun db:studio` |

---

## Useful scripts

| Command | Description |
|---------|-------------|
| `bun dev` | Start everything (server + web) |
| `bun dev:server` | Start API server only |
| `bun dev:web` | Start web app only |
| `bun db:push` | Push schema to database (no migration file) |
| `bun db:generate` | Generate a migration file from schema changes |
| `bun db:migrate` | Apply pending migrations |
| `bun db:studio` | Open Drizzle Studio (visual DB browser) |
| `bun eval` | Run CLI eval against the dataset |
| `bun check-types` | TypeScript type-check all packages |

---

## Troubleshooting

**`EADDRINUSE` on port 8787**
Something is already using the port. Find and kill it:
```bash
lsof -ti :8787 | xargs kill -9
```

**`Invalid environment variables` on server start**
The server can't find its `.env` file. Make sure you're starting from the repo root with `bun dev` or `bun dev:server`, not by running the file directly from a different directory.

**`Failed to fetch` in the browser**
The API server isn't running. Start it with `bun dev:server` and confirm it responds at http://localhost:8787.

**Auth / sign-in not working**
Ensure `BETTER_AUTH_SECRET` is set to a real 32+ character random string (not the placeholder). Then restart the server.

**Database connection error**
Verify PostgreSQL is running and the `DATABASE_URL` in `apps/server/.env` is correct:
```bash
psql postgres://postgres:postgres@localhost:5432/healosbench -c '\dt'
```
