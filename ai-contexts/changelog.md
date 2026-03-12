# TaskFlow — Session Changelog

> One entry per session. Most recent at top. Commit hash in each entry.

---

## 2026-03-12 (Session 2)

**Commits:** `6821646` ← `6a1567f` ← `b5ca7ea` ← `ce70a03`

### Done
- **Recurring tasks** — `recurrence` + `nextOccurrence` on Task model; auto-spawn on done; recurrence select in modal; badge on card
- **ai-contexts created** — INDEX, project, architecture, plan, changelog (this file)
- **Bug fix: stale modal state** — `editingTask` stale snapshot replaced with `editingTaskId` + live `tasks.find()`; `useEffect` added to re-sync modal fields on external task change

### Notes
- Vercel auto-deploy did NOT trigger from GitHub push — had to run `vercel --prod` manually. Check dashboard if deploy seems missing after a push.
- GPG signing sometimes times out in terminal sessions — unlock key via system tray before committing.

---

## 2026-03-10 (Session 1)

**Commits:** `eaf4fbe` → `c83d995` → `2408a6b` → `da0101f` → `b9ec633`

### Done
- **Project bootstrapped** — extracted TaskFlow from Portfolio into standalone Next.js 16 app at `E:\GITPRJ\taskflow\`
- **Backend** — Prisma 7 + PrismaNeon adapter + Neon Postgres; lazy `db.ts` Proxy; JWT auth via jose; Zod v4 validation; sliding-window rate limiting; all API routes (boards, tasks, labels, subtasks, comments, activity, health)
- **Sprint 1** — Labels/tags, Activity log
- **Sprint 2** — Subtasks/checklist, Task sorting (priority/due/newest), Bulk select/move/delete/priority
- **Sprint 3** — Task comments, Custom columns (rename/add/remove/reset), Recurring tasks

### Key fixes in this session
- `PrismaClientConstructorValidationError: Unknown property datasourceUrl` — Prisma 7 removed it; use adapter pattern
- `DATABASE_URL undefined at module eval` — fixed with lazy Proxy in `lib/db.ts`
- `GET /api/boards 401` — JWT_ACCESS_SECRET mismatch; updated Vercel env + redeployed AuthSaaS
- Zod v4: `.errors` → `.issues`; `required_error` removed
- Auth bypass: `findUnique(id)` → `findFirst({ id, userId })`
- TOCTOU in task PATCH: `updateMany({ id, userId })`

### Deployed
- Production: https://taskflow-gamma-liard.vercel.app
- Repo: https://github.com/Krisantha-VS/TaskFlow.git

---

## Pending (Future Tier) — next session pick up from here

| ID | Feature | Recommended order |
|----|---------|-------------------|
| F4 | Export CSV / .ics | **Start here** — no schema change |
| F1 | Analytics dashboard | Read-only aggregation, no schema change |
| F5 | Real-time sync (SSE) | No schema change |
| F2 | Subtask dependencies | Schema change |
| F3 | Sprint planning | Schema change, complex UI |
| F6 | Board sharing | Schema + email (Resend), most complex |
