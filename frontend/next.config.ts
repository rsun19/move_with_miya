import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/auth/:path*',
        destination: 'http://localhost:3001/auth/:path*',
      },
      {
        source: '/api/:path*',
        destination: 'http://localhost:3000/:path*',
      },
    ];
  },
  env: {
    NEXT_PUBLIC_AUTH_URL:
      process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:3001/auth/google',
  },
};

export default nextConfig;
