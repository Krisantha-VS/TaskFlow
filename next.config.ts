import type { NextConfig } from "next";

const AUTH_UPSTREAM = process.env.NEXT_PUBLIC_AUTH_URL ?? 'https://auth-saas.royalda.com/api/v1';

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
