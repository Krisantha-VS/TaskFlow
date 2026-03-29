// Auth calls go directly to AuthSaas (CORS is enabled on all auth endpoints)
export const AUTH_BASE =
  process.env.NEXT_PUBLIC_AUTH_URL ?? 'https://auth-saas-krisantha-vs-projects.vercel.app/api/v1';

export const AUTH_CLIENT_ID =
  process.env.NEXT_PUBLIC_AUTH_CLIENT_ID ?? '';
