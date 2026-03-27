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
| Bug | Stale state in task edit modal (labels, fields) | ✅ fixed |
| F1 | Analytics dashboard | ✅ done |
| F2 | Subtask dependencies (blocked-by) | ✅ done |
| F3 | Sprint planning (date range / sprint view) | ✅ done |
| F4 | Export (CSV / .ics) | ✅ done |
| F5 | Real-time sync (SSE / WebSocket) | ✅ done |
| F6 | Board sharing (invite by email, roles) | ✅ done |

**Progress: 14 / 14 features — 100% ✅** | Last audit: 2026-03-27 (ORG-001 + ORG-002 improvements committed, not pushed)

---

## Context Files

| File | What it covers | Load when... |
|------|---------------|--------------|
| `project.md` | Stack, env vars, deploy URLs, DB, auth | Starting any work |
| `architecture.md` | File map, API routes, data flow | Adding routes or refactoring |
| `plan.md` | Detailed spec for each pending feature | Planning next feature |
| `changelog.md` | Per-session log of what changed and why | Debugging or catching up |
| `schema.md` | Prisma schema + migration notes | DB / schema changes |

---

## How to Resume

1. Read `INDEX.md` (this file) — get status at a glance
2. Read `project.md` — environment and deploy context
3. Read the relevant feature spec from `plan.md`
4. Update status here when a feature lands

## Session 2026-03-12 — All Future Tier features completed

**Commits:** `4470dfc` (F4) · `f91dd08` (F1) · `4472e52` (F5) · `6677fd8` (F2) · `d436f30` (F3) · `3f1fc1a` (F6)

| Feature | Key files |
|---------|-----------|
| F4 Export | `app/api/boards/[id]/export/route.ts` |
| F1 Analytics | `app/api/boards/[id]/analytics/route.ts`, `analytics-panel.tsx` |
| F5 SSE | `lib/pubsub.ts`, `app/api/boards/[id]/stream/route.ts` |
| F2 Dependencies | `app/api/tasks/[id]/dependencies/route.ts`, schema: TaskDependency |
| F3 Sprints | `app/api/sprints/`, `sprint-selector.tsx`, schema: Sprint |
| F6 Members | `app/api/boards/[id]/members/`, `app/api/invites/[token]/`, `members-panel.tsx`, `lib/email.ts` |

**Schema changes (db push applied):** TaskDependency, Sprint, BoardMember models added. Task.sprintId added.

**Note:** F6 board sharing requires `RESEND_API_KEY` env var for email. Without it, invite link is shown in UI (copy-to-clipboard). Add to Vercel env when ready.

---

## Session 2026-03-27 — ORG-001 Audit + ORG-002 UI/UX Improvements

**Commits:** `bb5a84d` (ORG-001 audit fixes) · `af9d3a0` (ORG-002 Tier 1 + Tier 2) — NOT pushed

### ORG-001 Batch (bb5a84d) — Code quality, security, performance
- Auth bypass fix in invites route; rate limit on labels/comments routes
- Recurrence spawn in `db.$transaction()`; immutable date construction
- Analytics: `$queryRaw` GROUP BY DATE (replaced O(30×tasks) JS loops)
- SSE: granular typed events (task_created/updated/deleted/moved) + 60s idle timeout
- SSE client: local state mutations instead of full `load()` refetch
- `Promise.allSettled` in all bulk ops; `ConfirmDialog` replaces native `confirm()`
- `React.memo` on KanbanColumn + TaskCard; `useMemo` for getDueDateStyle
- DB connection pool + rate-limit eviction; Prisma indexes on TaskDependency + ActivityLog
- UX: search clear button, empty board/column states, sprint inline delete confirm, analytics error retry

### ORG-002 Tier 1 (af9d3a0) — WCAG 2.1 AA
- `confirm-dialog.tsx`: Escape key closes; `role=dialog` + `aria-labelledby`
- `label-pill.tsx`: `aria-label` on remove button
- `kanban-column.tsx`: placeholder contrast fixed; Select all `focus:opacity-100`
- `kanban-board.tsx`: focus returns to trigger on modal close; `aria-label` on sort + bulk selects; export dropdown `aria-expanded` + `role=menu` + Escape key

### ORG-002 Tier 2 (af9d3a0) — Visual & UX
- `kanban-column.tsx`: AnimatePresence + motion.div for task enter/exit + empty state fade
- `kanban-board.tsx`: label filter chips (toggle, clear all); `aria-live="polite"` region

**Next:** Push to production (`vercel --prod` from `E:\GITPRJ\taskflow\` if auto-deploy doesn't trigger)
**Remaining:** Tier 3 (task expand animation, drag easing, mobile toolbar, sprint badge on card)

---

## Recent Fixes (session 2026-03-10)
- **Stale modal state** — `editingTask` was a snapshot, never synced back after mutations.
  Fix: replaced with `editingTaskId` + `tasks.find()` so modal always reflects live state.
  Also added `useEffect` in `TaskEditModal` to re-sync local fields when task prop changes.
  Files: `kanban-board.tsx`, `task-edit-modal.tsx`
- **Vercel auto-deploy not triggering** — had to manually run `vercel --prod`. Note for future: trigger manually if GitHub push doesn't auto-deploy within ~2 min.
