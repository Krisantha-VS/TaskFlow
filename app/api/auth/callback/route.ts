import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// ─── GET /api/auth/callback ───────────────────────────────────────────────────
// Handles the OAuth redirect from AuthSaaS. Validates CSRF state, exchanges
// the authorization code for tokens, sets httpOnly refresh_token cookie.

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const appUrl  = (process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin).trim();
  const appRoot = new URL('/', appUrl);

  const cookieStore = await cookies();
  const stateCookie     = cookieStore.get('oauth_state')?.value;
  const codeVerifier    = cookieStore.get('oauth_code_verifier')?.value;

  // Helper: redirect home with an error query param
  const fail = (reason: string) => {
    const dest = new URL(appRoot);
    dest.searchParams.set('auth_error', reason);
    const res = NextResponse.redirect(dest);
    res.cookies.delete('oauth_state');
    res.cookies.delete('oauth_code_verifier');
    return res;
  };

  // OAuth error from AuthSaaS
  if (error) return fail(`oauth_error:${error}`);

  // CSRF — validate state
  if (!stateCookie || !state || state !== stateCookie) return fail('state_mismatch');

  // Required params
  if (!code)         return fail('missing_code');
  if (!codeVerifier) return fail('missing_verifier');

  // Backend-to-backend token exchange
  const authBase   = (process.env.NEXT_PUBLIC_AUTH_URL ?? 'https://auth-saas.royalda.com/api/v1').trim();
  const clientId   = (process.env.NEXT_PUBLIC_AUTH_CLIENT_ID ?? '').trim();
  const redirectUri = `${appUrl}/api/auth/callback`;

  try {
    const tokenRes = await fetch(`${authBase}/oauth/token`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type:    'authorization_code',
        code,
        client_id:     clientId,
        code_verifier: codeVerifier,
        redirect_uri:  redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.success) {
      console.error('[oauth/callback] token exchange failed:', tokenData);
      return fail('token_exchange_failed');
    }

    const { refresh_token } = tokenData.data;

    // Redirect to app root
    const res = NextResponse.redirect(appRoot);

    // Clear temporary OAuth cookies
    res.cookies.delete('oauth_state');
    res.cookies.delete('oauth_code_verifier');

    // Refresh token → httpOnly cookie on TaskFlow domain.
    // On page load, /api/auth/refresh proxy reads this and returns a fresh access_token.
    res.cookies.set('refresh_token', refresh_token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path:     '/api',
      maxAge:   7 * 24 * 60 * 60,
    });

    return res;

  } catch (e) {
    console.error('[oauth/callback] fetch error:', e);
    return fail('network_error');
  }
}
