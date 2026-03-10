// Auth calls go through /proxy/auth (Next.js rewrite → AuthSaas server-side, no CORS)
export const AUTH_BASE = '/proxy';

export const AUTH_CLIENT_ID =
  process.env.NEXT_PUBLIC_AUTH_CLIENT_ID ?? '';
