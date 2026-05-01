# Local Setup Guide

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| [Bun](https://bun.sh) | ≥ 1.3 | `curl -fsSL https://bun.sh/install \| bash` |
| PostgreSQL | ≥ 14 | Local install **or** Docker (see below) |

You also need an **Anthropic API key** — get one at [console.anthropic.com](https://console.anthropic.com).

---

## 1. Install dependencies

```bash
bun install
```

---

## 2. Configure environment variables

```bash
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env.local
```

Open `apps/server/.env` and fill in the two required values:

```env
ANTHROPIC_API_KEY=sk-ant-...   # your Anthropic key
DATABASE_URL=postgres://postgres:postgres@localhost:5432/healosbench
```

Everything else in the file can stay as-is for local dev.

---

## 3. Start PostgreSQL

**Option A — local install (Homebrew)**
```bash
brew services start postgresql@16
psql -U postgres -c "CREATE DATABASE healosbench;"
```

**Option B — Docker**
```bash
docker run -d \
  --name healosbench-db \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:16
docker exec -it healosbench-db psql -U postgres -c "CREATE DATABASE healosbench;"
```

Then push the schema:

```bash
bun db:push
```

---

## 4. Start the application

```bash
bun dev
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
| `bun db:push` | Push schema to database |
| `bun db:studio` | Open Drizzle Studio (visual DB browser) |
| `bun eval` | Run CLI eval against the dataset |
| `bun check-types` | TypeScript type-check all packages |

---

## Troubleshooting

**`EADDRINUSE` on port 8787**
```bash
lsof -ti :8787 | xargs kill -9
```

**`Failed to fetch` in the browser**
The API server isn't running. Start it with `bun dev:server` and confirm it responds at http://localhost:8787.

**Database connection error**
Verify PostgreSQL is running and `DATABASE_URL` in `apps/server/.env` is correct:
```bash
psql postgres://postgres:postgres@localhost:5432/healosbench -c '\dt'
```
