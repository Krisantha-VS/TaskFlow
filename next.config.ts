import type { NextConfig } from "next";

const AUTH_UPSTREAM = process.env.AUTH_UPSTREAM_URL ?? process.env.NEXT_PUBLIC_AUTH_URL ?? 'https://auth-saas.royalda.com/api/v1';

const CSP = [
  "default-src 'self'",
  // 'unsafe-inline' for theme-detection script; 'unsafe-eval' for Framer Motion
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://auth-saas.royalda.com https://cloudflareinsights.com",
  "frame-ancestors 'none'",
].join('; ');

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: CSP },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/proxy/auth/:path*',
        destination: `${AUTH_UPSTREAM}/auth/:path*`,
      },
    ];
  },
};

export default nextConfig;
