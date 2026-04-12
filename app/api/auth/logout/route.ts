import { NextResponse } from 'next/server';

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
// Clears the httpOnly refresh_token cookie so a page refresh does not
// silently re-authenticate the user after they sign out.

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set('refresh_token', '', {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/api',
    maxAge:   0,
  });
  return res;
}
