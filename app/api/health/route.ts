import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  // Network reachability probe
  let fetchOk = false;
  let fetchErr = '';
  try {
    const host = (process.env.DATABASE_URL ?? '').match(/@([^/]+)\//)?.[1] ?? '';
    const r = await fetch(`https://${host}/sql/v1`, { method: 'HEAD' });
    fetchOk = true;
    fetchErr = `${r.status}`;
  } catch (e) {
    fetchErr = e instanceof Error ? e.message : String(e);
  }

  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', db: 'connected', fetchOk, fetchErr, timestamp: new Date().toISOString() });
  } catch (e) {
    const reason = JSON.stringify(e, Object.getOwnPropertyNames(e as object));
    return NextResponse.json({ status: 'error', db: 'disconnected', fetchOk, fetchErr, reason }, { status: 503 });
  }
}
