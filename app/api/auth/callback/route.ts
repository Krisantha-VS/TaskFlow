import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// ─── GET /api/auth/callback ───────────────────────────────────────────────────
// Handles the OAuth redirect from AuthSaaS. Validates CSRF state, exchanges
// the authorization code for tokens, then returns a 200 HTML page that sets
// cookies via Set-Cookie headers (more reliable than cookies-on-redirect in
// Next.js GET handlers) and meta-refreshes to app root.

const REFRESH_TTL = 7 * 24 * 60 * 60;
const INIT_TTL    = 30; // seconds — short-lived readable cookie for initial access token

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const appUrl  = (process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin).trim();
  const appRoot = '/';

  const cookieStore = await cookies();
  const stateCookie  = cookieStore.get('oauth_state')?.value;
  const codeVerifier = cookieStore.get('oauth_code_verifier')?.value;

  const secure = process.env.NODE_ENV === 'production';

  // Clears PKCE cookies and redirects home with an error param
  const fail = (reason: string) => {
    const dest = new URL(`${appUrl}/?auth_error=${encodeURIComponent(reason)}`);
    const res = NextResponse.redirect(dest);
    res.cookies.delete('oauth_state');
    res.cookies.delete('oauth_code_verifier');
    return res;
  };

  if (error)                                              return fail(`oauth_error:${error}`);
  if (!stateCookie || !state || state !== stateCookie)    return fail('state_mismatch');
  if (!code)                                              return fail('missing_code');
  if (!codeVerifier)                                      return fail('missing_verifier');

  const authBase    = (process.env.NEXT_PUBLIC_AUTH_URL ?? 'https://auth-saas.royalda.com/api/v1').trim();
  const clientId    = (process.env.NEXT_PUBLIC_AUTH_CLIENT_ID ?? '').trim();
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

    const { access_token, refresh_token } = tokenData.data;

    const cookieBase = `Path=/api; Max-Age=${REFRESH_TTL}; SameSite=Lax${secure ? '; Secure' : ''}`;
    const initBase   = `Path=/; Max-Age=${INIT_TTL}; SameSite=Lax${secure ? '; Secure' : ''}`;

    // Return a 200 HTML page — browser always commits Set-Cookie on 200 responses,
    // unlike on 302 redirects which some Next.js versions handle inconsistently.
    const html = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${appRoot}"><title>Signing in...</title></head><body></body></html>`;

    const res = new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });

    // httpOnly refresh token for the /api/auth/refresh proxy
    res.headers.append('Set-Cookie', `refresh_token=${refresh_token}; HttpOnly; ${cookieBase}`);
    // short-lived readable cookie — client reads it once on init, then deletes it
    res.headers.append('Set-Cookie', `_at_init=${encodeURIComponent(access_token)}; ${initBase}`);
    // clear PKCE cookies
    res.headers.append('Set-Cookie', `oauth_state=; Path=/; Max-Age=0`);
    res.headers.append('Set-Cookie', `oauth_code_verifier=; Path=/; Max-Age=0`);

    return res;

  } catch (e) {
    console.error('[oauth/callback] fetch error:', e);
    return fail('network_error');
  }
}
