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
  return true;
}
