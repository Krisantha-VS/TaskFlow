# TaskFlow — Architecture & File Map

## API Routes
```
app/api/
  health/route.ts              GET  — DB health check
  boards/route.ts              GET POST
  boards/[id]/route.ts         PATCH DELETE
  boards/[id]/columns/route.ts PUT  — update column config
  tasks/route.ts               GET POST
  tasks/[id]/route.ts          PATCH DELETE  (recurrence auto-spawn on done)
  tasks/[id]/labels/route.ts   POST DELETE  (connect/disconnect)
  tasks/[id]/subtasks/route.ts GET POST
  tasks/[id]/comments/route.ts GET POST
  subtasks/[id]/route.ts       PATCH DELETE
  comments/[id]/route.ts       PATCH DELETE
  labels/route.ts              GET POST
  labels/[id]/route.ts         DELETE
  activity/route.ts            GET  — last 50 logs for board
```

## Lib
```
lib/db.ts          Prisma client (lazy Proxy, PrismaNeon adapter)
lib/jwt.ts         verifyJWT + extractBearer (jose)
lib/api.ts         ok() fail() handleError() AuthError
lib/rate-limit.ts  sliding window 120/min per user
lib/validate.ts    Zod schemas for all CRUD inputs
lib/activity.ts    logActivity() fire-and-forget helper
```

## Features (Domain Logic)
```
features/task-manager/
  types/index.ts                Board, Task, Label, Subtask, Comment, ActivityLog, BoardColumn
  api/index.ts                  taskApi — all fetch wrappers
  hooks/useTasks.ts             all state + operations
  components/
    task-manager-app.tsx        top-level: board list, board select/delete
    kanban-board.tsx            search, sort, bulk ops, undo toast, ColumnEditor
    kanban-column.tsx           column with select-all
    task-card.tsx               card UI: labels, subtask bar, due color, recurrence badge
    task-edit-modal.tsx         full edit: subtasks, labels, comments, activity, recurrence
```

## Shared Components
```
components/
  error-boundary.tsx    React class error boundary
  confirm-dialog.tsx    reusable modal confirmation
  label-pill.tsx        color pill with static Tailwind map
  activity-feed.tsx     timeline + timeAgo
  column-editor.tsx     rename/add/remove/reset columns
```

## Prisma Schema Models
Board → Task[] Label[]
Task → Label[] (M2M "TaskLabels") Subtask[] Comment[]
ActivityLog (standalone, taskId nullable)
Subtask, Comment (cascade delete with Task)

## Data Flow
1. Client → JWT header → API route
2. API route: verifyJWT → checkRateLimit → Zod parse → Prisma query → logActivity → ok()
3. Ownership always enforced: all queries include `userId` in where clause
