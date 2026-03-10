# TaskFlow AI Context Index

> Load only what you need. Each file is self-contained.

## Quick Status

| Sprint | Feature | Status |
|--------|---------|--------|
| S1 | Labels / tags | ✅ done |
| S1 | Activity log | ✅ done |
| S2 | Subtasks / checklist | ✅ done |
| S2 | Task sorting (priority / due / newest) | ✅ done |
| S2 | Bulk select / move / delete / priority | ✅ done |
| S3 | Task comments | ✅ done |
| S3 | Custom columns (rename / add / remove) | ✅ done |
| S3 | Recurring tasks (daily/weekly/monthly) | ✅ done |
| F1 | Analytics dashboard | ⬜ pending |
| F2 | Subtask dependencies (blocked-by) | ⬜ pending |
| F3 | Sprint planning (date range / sprint view) | ⬜ pending |
| F4 | Export (CSV / .ics) | ⬜ pending |
| F5 | Real-time sync (SSE / WebSocket) | ⬜ pending |
| F6 | Board sharing (invite by email, roles) | ⬜ pending |

**Progress: 8 / 14 features — ~57%**

---

## Context Files

| File | What it covers | Load when... |
|------|---------------|--------------|
| `project.md` | Stack, env vars, deploy URLs, DB, auth | Starting any work |
| `architecture.md` | File map, API routes, data flow | Adding routes or refactoring |
| `plan.md` | Detailed spec for each pending feature | Planning next feature |
| `schema.md` | Prisma schema + migration notes | DB / schema changes |

---

## How to Resume

1. Read `INDEX.md` (this file) — get status at a glance
2. Read `project.md` — environment and deploy context
3. Read the relevant feature spec from `plan.md`
4. Update status here when a feature lands
