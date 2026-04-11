import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────
// Proxy: reads the httpOnly refresh_token cookie (same domain), calls AuthSaaS
// server-side (no CORS), and rotates the cookie + returns new access_token.

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('refresh_token')?.value;

  if (!refreshToken) {
    return NextResponse.json({ success: false, error: 'No refresh token' }, { status: 401 });
  }

  const authBase = (process.env.NEXT_PUBLIC_AUTH_URL ?? 'https://auth-saas.royalda.com/api/v1').trim();

  try {
    const upstream = await fetch(`${authBase}/auth/refresh`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refreshToken }),
    });

    const data = await upstream.json();

    if (!upstream.ok || !data.success) {
      return NextResponse.json({ success: false, error: 'Refresh failed' }, { status: 401 });
    }

    const { accessToken, refreshToken: newRefresh } = data.data;

    const res = NextResponse.json({ success: true, data: { accessToken } });

    // Rotate refresh_token cookie on TaskFlow's own domain
    res.cookies.set('refresh_token', newRefresh, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path:     '/api',
      maxAge:   7 * 24 * 60 * 60,
    });

    return res;
  } catch {
    return NextResponse.json({ success: false, error: 'Refresh error' }, { status: 500 });
  }
}
