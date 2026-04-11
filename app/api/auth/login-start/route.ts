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

// ─── POST /api/auth/login-start ───────────────────────────────────────────────
// Generates PKCE params + state server-side, stores them in httpOnly cookies,
// returns the OAuth authorize URL for the client to redirect to.

export async function POST(req: NextRequest) {
  const authBase = (process.env.NEXT_PUBLIC_AUTH_URL ?? 'https://auth-saas.royalda.com/api/v1')
    .trim()
    .replace(/\/api\/v1\/?$/, '');
  const clientId = (process.env.NEXT_PUBLIC_AUTH_CLIENT_ID ?? '').trim();
  // Always use the actual request origin so cookies and redirect_uri are on the same domain
  const appUrl     = req.nextUrl.origin;
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

  const res = NextResponse.json({ authUrl });

  const cookieOpts = {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax'  as const,
    path:     '/',
    maxAge:   300, // 5 minutes
  };

  res.cookies.set('oauth_state',         state,        cookieOpts);
  res.cookies.set('oauth_code_verifier', codeVerifier, cookieOpts);

  return res;
}
