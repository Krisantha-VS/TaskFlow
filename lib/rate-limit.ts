// Simple sliding window rate limiter (per-user, in-process)
// Good enough for single-instance dev/staging. For multi-instance production, replace with Upstash.

const windows = new Map<string, number[]>();
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 120; // per user per minute

export function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const timestamps = (windows.get(userId) ?? []).filter(t => now - t < WINDOW_MS);
  if (timestamps.length >= MAX_REQUESTS) return false;
  timestamps.push(now);
  windows.set(userId, timestamps);

  // Evict entries where the user's last request is older than 2 minutes
  const EVICT_MS = 120_000;
  for (const [uid, ts] of windows) {
    if (ts.length === 0 || now - ts[ts.length - 1] > EVICT_MS) {
      windows.delete(uid);
    }
  }

  return true;
}
