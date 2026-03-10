# TaskFlow — Project Context

## Identity
- **App:** TaskFlow — serverless kanban task manager
- **Repo:** https://github.com/Krisantha-VS/TaskFlow.git
- **Production:** https://taskflow-gamma-liard.vercel.app
- **Branch:** master

## Stack
- Next.js 16 App Router (TypeScript)
- Tailwind CSS v4
- Prisma 7 + @prisma/adapter-neon + @neondatabase/serverless
- Neon Postgres (serverless)
- AuthSaaS (external auth at auth-saas-rho.vercel.app)
- jose (JWT verification)
- Zod v4 (validation)
- Vercel (deploy)

## Key Environment Variables (Vercel)
- `DATABASE_URL` — Neon connection string
- `JWT_ACCESS_SECRET` — shared with AuthSaaS
- `NEXT_PUBLIC_AUTH_URL` — AuthSaaS base URL

## Auth Flow
- AuthSaaS issues JWT; client sends `Authorization: Bearer <token>`
- `lib/jwt.ts` verifies with jose; extracts `payload.sub` as userId
- `/proxy/auth/*` rewrites route requests to AuthSaaS server-side (next.config.ts)

## DB / Prisma Notes
- Prisma 7 requires adapter — no `url` in `datasource db {}` in schema.prisma
- Connection config in `prisma.config.ts` (PrismaNeon adapter)
- `lib/db.ts` uses lazy Proxy to defer DATABASE_URL read until first query
- Run schema changes with `npx prisma db push` (NOT migrate dev — Neon has no shadow DB)

## Commit Convention
- No Co-Authored-By lines — sole author only
- Stage feature commits: `git add <specific files>` then commit with descriptive message
- GPG signed commits

## Rate Limiting
- `lib/rate-limit.ts` — sliding window 120 req/min per userId (in-process)
