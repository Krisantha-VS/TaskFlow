import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  // Network reachability probe
  let fetchOk = false;
  let fetchErr = '';
  const host = (process.env.DATABASE_URL ?? '').match(/@([^/]+)\//)?.[1] ?? 'NOT_SET';
  const directHost = host.replace('-pooler', '');
  try {
    const r = await fetch(`https://${directHost}/sql/v1`, { method: 'HEAD' });
    fetchOk = true;
    fetchErr = `${r.status}`;
  } catch (e) {
    fetchErr = e instanceof Error ? e.message : String(e);
  }

  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', db: 'connected', host, directHost, fetchOk, fetchErr, timestamp: new Date().toISOString() });
  } catch (e) {
    const reason = JSON.stringify(e, Object.getOwnPropertyNames(e as object));
    return NextResponse.json({ status: 'error', db: 'disconnected', host, directHost, fetchOk, fetchErr, reason }, { status: 503 });
  }
}
