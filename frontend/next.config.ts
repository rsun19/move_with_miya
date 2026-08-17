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
    const userService = process.env.USER_SERVICE_URL || 'http://localhost:3003';
    const backend = process.env.BACKEND_URL || 'http://localhost:3002';
    return [
      {
        source: '/api/auth/:path*',
        destination: `${userService}/auth/:path*`,
      },
      {
        source: '/api/users/:path*',
        destination: `${userService}/users/:path*`,
      },
      {
        source: '/api/:path*',
        destination: `${backend}/:path*`,
      },
    ];
  },
  env: {
    NEXT_PUBLIC_AUTH_URL:
      process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:3003/auth/google',
  },
};

export default nextConfig;
