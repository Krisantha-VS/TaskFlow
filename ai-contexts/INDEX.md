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

**Progress: 14 / 14 features — 100% ✅** | Last audit: 2026-04-02 (PLAN-005 all 29 tasks — Tier 1 ✅ Tier 2 ✅ Tier 3 ✅, pushed `28b0042`)

---

## Session 2026-05-31 — Auth migration + bug fixes + issue numbers

**Commits:** `ce708ce` (auth review fixes) · `02e54b1` (issueNumber feature) · `120c279` (Neon transaction fix)

### Auth rewrite (OAuth PKCE — committed before this session)
- Full OAuth Authorization Code + PKCE flow replacing inline email/password auth
- New routes: `/api/auth/login-start`, `/api/auth/callback`, `/api/auth/refresh`, `/api/auth/logout`
- `refresh_token` → httpOnly cookie (`Path=/api`); `access_token` → sessionStorage
- `_at_init` 30s readable cookie pattern for post-OAuth token handoff

### Bug fixes applied this session (`ce708ce`)
- `doRefresh()` no longer dispatches `auth:expired` or calls `clearTokens()` — anonymous page loads no longer fire spurious API requests
- `authFetch` owns the `auth:expired` signal (only fires mid-session)
- Removed duplicate `auth:expired` listener from `TaskManagerApp` (was causing double `/api/auth/logout` POST)
- `dependencies/route.ts` P2002 catch: guard `findFirst` null → return 409 instead of `ok(null, 201)`
- `next.config.ts`: added `cloudflareinsights.com` to `connect-src`
- Removed dead `AUTH_BASE`/`AUTH_CLIENT_ID` import and `OAUTH_PKCE_METHOD` export

### Issue numbers feature (`02e54b1` + `120c279`)
- `Board.nextIssueNumber` counter; `Task.issueNumber` per-board unique (`@@unique([boardId, issueNumber])`)
- Task create/recurrence spawn assigns issue number via sequential DB queries (NOT `$transaction` — Neon HTTP adapter unsupported)
- `TaskDependency.type` column: blocks / depends_on / relates_to / duplicates / closes
- `useTasks`: `normalizeTask()` maps camelCase API → snake_case types; `recentlyMutated` ref prevents SSE echo double-updates
- Subtask create/toggle/delete synced to parent `tasks[]` array
- `getActivity` passes `task_id` filter server-side; no client-side filtering

### Key constraint: Neon HTTP adapter does NOT support `db.$transaction()`
Use sequential queries. The `nextIssueNumber` increment is safe without a wrapper — `UPDATE ... SET n = n+1` is atomic in Postgres.

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

**Tier 3 commit:** `24867e8` — task expand animation, spring drag, sprint badge, mobile toolbar
**Next:** Push to production — `git push` then `vercel --prod` if auto-deploy doesn't trigger within 2 min

---

## Session 2026-04-02 — PLAN-005 UI/UX & Functionality Improvements (all 29 tasks)

**Commits:** `ed45e41` (Tier 1) · `28b0042` (Tiers 2 & 3) — pushed to remote

### Tier 1 — Accessibility blockers + motion foundation
- `lib/useMotion.ts` (new): `useReducedMotion()` hook using matchMedia
- `confirm-dialog.tsx`: AnimatePresence entrance/exit (scale + opacity), respects reduced motion
- `task-edit-modal.tsx`: AnimatePresence backdrop + panel animation, modal opens/closes with motion
- `globals.css`: `.badge-blocked` CSS class; `.label-*` utility classes; `--priority-low` vars; WCAG muted-foreground contrast fix; `button { transition-duration: 100ms }; .btn-primary/.btn-secondary`
- `label-pill.tsx`: CSS utility class names instead of Tailwind arbitrary; `text-xs` fixes
- `error-boundary.tsx`: `role=alert` + `aria-live=assertive`
- `column-editor.tsx`: `<label htmlFor>` + `aria-label` for delete buttons
- Export menu: auto-focus first item, ArrowUp/Down keyboard nav

### Tier 2 — DnD + UX Polish
- **@dnd-kit/core**: `kanban-board.tsx` uses DndContext + DragOverlay; `kanban-column.tsx` uses useDroppable; `task-card.tsx` uses useDraggable on grip handle only
- Touch support: PointerSensor (8px threshold) + TouchSensor (200ms delay)
- DragOverlay ghost: rotate-1 + 0.95 opacity; layout-animated card exit/enter
- Checkbox + select-all always visible; Cmd/Ctrl+Click multi-select
- Collapsible Subtasks + Blockers in task-edit-modal
- Blocked badge: shows blocker title + overflow count
- `text-[10px]` → `text-xs` throughout; task title `font-semibold`
- Undo toast (30s) with actionable Undo button
- URL param sync: `?sprint=&labels=` via `replaceState`
- `aria-hidden` on all decorative icons; sr-only search label

### Tier 3 — Features
- Breadcrumb "Dashboard > [Board Name]" in task-manager-app
- Skip nav link + `<main id="main-content">` landmark
- **Dependencies panel** (`dependencies-panel.tsx`): board-wide blocker list + warns when blocker unresolved
- **Sprints panel** (`sprints-panel.tsx`): full create/delete/select; active sprint chip replaces inline SprintSelector
- **Trash / soft-delete**: `prisma/schema.prisma` + `db push` — `Task.deletedAt`; DELETE sets `deletedAt`; hard-delete via `x-hard-delete: 1` header
- `GET /api/tasks` filters `deletedAt: null`; `GET /api/boards/[id]/trash` lists soft-deleted; `POST /api/tasks/[id]/restore` clears `deletedAt`
- **Trash panel** (`trash-panel.tsx`): lists, restores, permanently deletes
- Toolbar buttons: Flag (Sprints), GitBranch (Deps), Trash2 (Trash)
- Skeleton column/card loaders; empty board onboarding card
- Recurrence field renamed "Recurring task" with tooltip

---

## Recent Fixes (session 2026-03-10)
- **Stale modal state** — `editingTask` was a snapshot, never synced back after mutations.
  Fix: replaced with `editingTaskId` + `tasks.find()` so modal always reflects live state.
  Also added `useEffect` in `TaskEditModal` to re-sync local fields when task prop changes.
  Files: `kanban-board.tsx`, `task-edit-modal.tsx`
- **Vercel auto-deploy not triggering** — had to manually run `vercel --prod`. Note for future: trigger manually if GitHub push doesn't auto-deploy within ~2 min.
