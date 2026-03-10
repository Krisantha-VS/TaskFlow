import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

export function handleError(e: unknown) {
  if (e instanceof ZodError) {
    return fail(e.issues.map((x: { message: string }) => x.message).join(', '), 400);
  }
  if (e instanceof AuthError) return fail('Unauthorized', 401);
  console.error('[taskflow]', e);
  return fail('Internal server error', 500);
}

export class AuthError extends Error {}
