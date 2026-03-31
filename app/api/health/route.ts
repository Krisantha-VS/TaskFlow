import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch (e) {
    const reason = JSON.stringify(e, Object.getOwnPropertyNames(e as object));
    return NextResponse.json({ status: 'error', db: 'disconnected', reason }, { status: 503 });
  }
}
