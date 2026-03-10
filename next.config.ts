import type { NextConfig } from "next";

const AUTH_UPSTREAM = process.env.NEXT_PUBLIC_AUTH_URL ?? 'https://auth-saas.vercel.app/api/v1';

const nextConfig: NextConfig = {
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
