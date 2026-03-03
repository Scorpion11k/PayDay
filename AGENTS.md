# AGENTS.md

## Cursor Cloud specific instructions

### Overview

PayDay AI is a two-service monorepo: a React client (Vite, port 5173) and an Express API server (Prisma ORM, port 3001) backed by PostgreSQL.

### Services

| Service | Dir | Dev command | Port |
|---------|-----|-------------|------|
| Server (Express + Prisma) | `server/` | `npm run dev` | 3001 |
| Client (React + Vite) | `client/` | `npm run dev` | 5173 |

The Vite dev server proxies `/api` requests to the Express server on port 3001.

### Prerequisites

- **PostgreSQL** must be running (`sudo service postgresql start`). The default connection string is `postgresql://postgres:postgres@localhost:5432/payday?schema=public`.
- The server requires a `.env` file at `server/.env`. Copy from `server/env.example` if it doesn't exist.
- After installing server dependencies, Prisma Client is auto-generated via the `postinstall` hook.
- Run `npm run db:migrate` in `server/` to apply migrations before first start.
- Seed templates with `npx ts-node prisma/seed-templates.ts` in `server/` (idempotent upsert).

### Lint / Type-check / Build

- **Client lint**: `cd client && npm run lint` (ESLint 9, has ~16 pre-existing errors)
- **Client type-check**: `cd client && npx tsc -b` (has 1 pre-existing error: missing `@types/stylis`)
- **Server type-check**: `cd server && npx tsc --noEmit` (clean)
- **Client build**: `cd client && npm run build` (runs `tsc -b && vite build`)
- **Server build**: `cd server && npm run build` (runs `tsc`)

### Gotchas

- The root `package-lock.json` is a stub (empty packages) — dependencies live in `client/` and `server/` separately.
- External services (Gemini API, Twilio, Gmail) are optional; the app runs without them but AI chat features need `GEMINI_API_KEY`.
- The server uses `nodemon` with `ts-node` for dev mode hot-reload. If you add new npm dependencies, restart the server process.
