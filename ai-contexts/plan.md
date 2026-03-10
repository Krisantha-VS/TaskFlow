# TaskFlow — Feature Plan (Future Tier)

Status key: ⬜ pending · 🔄 in progress · ✅ done

---

## F1 — Analytics Dashboard ⬜

**Goal:** Board-level insights panel showing task completion trends and velocity.

**Scope:**
- API: `GET /api/boards/[id]/analytics` — aggregate counts by status/priority, completions over last 30 days
- UI: slide-in panel or dedicated tab on KanbanBoard
- Charts: use `recharts` (lightweight, tree-shakeable)
- Metrics: tasks created vs completed (7d/30d), breakdown by priority, avg completion time

**Files to create/edit:**
- `app/api/boards/[id]/analytics/route.ts` (new)
- `features/task-manager/components/analytics-panel.tsx` (new)
- `features/task-manager/api/index.ts` — add `getAnalytics(boardId)`
- `kanban-board.tsx` — add analytics toggle button

---

## F2 — Subtask Dependencies ⬜

**Goal:** Mark a task as blocked by another task on the same board.

**Scope:**
- Schema: new `TaskDependency` model (`blockerId Int`, `blockedId Int`, unique pair, both FK to Task)
- API: `POST /api/tasks/[id]/dependencies` body `{ blocker_id }`, `DELETE /api/tasks/[id]/dependencies/[blockerId]`
- UI: dependency list in task-edit-modal; blocked tasks show a 🔒 badge on task-card
- Validation: prevent circular dependencies (depth-1 check is sufficient for v1)

**Files to create/edit:**
- `prisma/schema.prisma` — add TaskDependency model
- `app/api/tasks/[id]/dependencies/route.ts` (new)
- `features/task-manager/types/index.ts` — add Dependency type
- `task-edit-modal.tsx` — dependencies section
- `task-card.tsx` — blocked badge

---

## F3 — Sprint Planning ⬜

**Goal:** Group tasks into named sprints with a start/end date; sprint board view.

**Scope:**
- Schema: new `Sprint` model (`boardId`, `name`, `startDate`, `endDate`); `sprintId Int?` on Task
- API: CRUD `GET/POST /api/sprints`, `PATCH/DELETE /api/sprints/[id]`, `PATCH /api/tasks/[id]` already handles sprintId
- UI: Sprint selector in board header; sprint view shows only sprint tasks grouped by status; backlog view = tasks with no sprint

**Files to create/edit:**
- `prisma/schema.prisma` — Sprint model, sprintId on Task
- `app/api/sprints/route.ts`, `app/api/sprints/[id]/route.ts` (new)
- `features/task-manager/components/sprint-selector.tsx` (new)
- `kanban-board.tsx` — sprint filter mode

---

## F4 — Export (CSV / .ics) ⬜

**Goal:** Export board tasks to CSV for spreadsheet import, or .ics for calendar apps.

**Scope:**
- API: `GET /api/boards/[id]/export?format=csv|ics`
- CSV: id, title, description, status, priority, dueDate, labels, subtask count
- ICS: one VEVENT per task that has a dueDate; SUMMARY=title, DESCRIPTION=description
- UI: Export button (dropdown: CSV / Calendar) in board header

**Files to create/edit:**
- `app/api/boards/[id]/export/route.ts` (new) — streams response with correct Content-Type
- `kanban-board.tsx` — export dropdown button
- No new npm deps needed (ICS is plain text; CSV is string join)

---

## F5 — Real-time Sync (SSE) ⬜

**Goal:** Board updates pushed to all open browser tabs without polling.

**Scope:**
- API: `GET /api/boards/[id]/stream` — SSE endpoint; emits JSON events on task create/update/delete
- Use a simple in-process pub/sub Map (per boardId, Set of WritableStreamDefaultWriter)
- `logActivity` triggers pub/sub emit after write
- UI: `useEffect` subscribes to EventSource on board open; on event, re-fetch affected resource or patch local state

**Files to create/edit:**
- `app/api/boards/[id]/stream/route.ts` (new)
- `lib/pubsub.ts` (new) — in-process Map<boardId, Set<controller>>
- `lib/activity.ts` — emit after log
- `features/task-manager/hooks/useTasks.ts` — SSE subscription

**Note:** In-process pub/sub only works on single Vercel instance. Good for v1; upgrade to Redis pub/sub for multi-instance later.

---

## F6 — Board Sharing (Invite by Email, Roles) ⬜

**Goal:** Owner can invite other users by email; invited users get viewer or editor access.

**Scope:**
- Schema: new `BoardMember` model (`boardId`, `userId`, `role: owner|editor|viewer`, `inviteEmail`, `inviteToken`, `acceptedAt`)
- API:
  - `POST /api/boards/[id]/members` — create invite, send email (use Resend free tier)
  - `GET /api/boards/[id]/members` — list members
  - `DELETE /api/boards/[id]/members/[userId]` — remove member
  - `GET /api/invites/[token]` — accept invite (sets acceptedAt, links userId)
- Auth changes: boards/tasks GET must include boards where user is a member
- UI: Members panel in board settings; invite form (email + role); member list with remove button

**Files to create/edit:**
- `prisma/schema.prisma` — BoardMember model
- `app/api/boards/[id]/members/route.ts` (new)
- `app/api/invites/[token]/route.ts` (new)
- `lib/email.ts` (new) — Resend client wrapper
- `features/task-manager/components/members-panel.tsx` (new)
- `app/api/boards/route.ts` — update GET to include shared boards

---

## Implementation Order (Recommended)

1. **F4 Export** — self-contained, no schema change, high user value, quick win
2. **F1 Analytics** — read-only aggregation, no schema change
3. **F5 Real-time** — enhances existing features, no schema change
4. **F2 Dependencies** — schema change, moderate complexity
5. **F3 Sprint planning** — schema change, highest complexity in UI
6. **F6 Board sharing** — schema + email infra, save for last
