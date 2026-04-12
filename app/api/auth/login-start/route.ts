import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

function generateState(): string {
  return crypto.randomBytes(32).toString('base64url');
}

// ─── GET /api/auth/login-start ────────────────────────────────────────────────
// Browser navigates here directly (window.location.href). Generates PKCE +
// state server-side, sets httpOnly cookies in the redirect response, then
// redirects the browser straight to AuthSaaS /oauth/login.
// Using GET + redirect (not POST + fetch) ensures cookies are always stored
// before the browser leaves the page.

export async function GET(req: NextRequest) {
  const authBase = (process.env.NEXT_PUBLIC_AUTH_URL ?? 'https://auth-saas.royalda.com/api/v1')
    .trim()
    .replace(/\/api\/v1\/?$/, '');
  const clientId    = (process.env.NEXT_PUBLIC_AUTH_CLIENT_ID ?? '').trim();
  const appUrl      = (process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin).trim();
  const redirectUri = `${appUrl}/api/auth/callback`;

  const codeVerifier  = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state         = generateState();

  const params = new URLSearchParams({
    client_id:             clientId,
    redirect_uri:          redirectUri,
    code_challenge:        codeChallenge,
    code_challenge_method: 'S256',
    state,
    response_type:         'code',
  });

  const authUrl = `${authBase}/oauth/login?${params.toString()}`;

  // 302 redirect to AuthSaaS with cookies in the same response
  const res = NextResponse.redirect(authUrl, { status: 302 });

  const cookieOpts = {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path:     '/',
    maxAge:   300,
  };

  res.cookies.set('oauth_state',         state,        cookieOpts);
  res.cookies.set('oauth_code_verifier', codeVerifier, cookieOpts);

  return res;
}
