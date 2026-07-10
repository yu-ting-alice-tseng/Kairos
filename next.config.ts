import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@libsql/client', '@prisma/adapter-libsql', '@prisma/client'],
  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
    // Google Drive sync drops desktop.ini files into .next/dev/cache/turbopack/,
    // which corrupts Turbopack's persistent cache and crashes `next dev` on startup.
    turbopackFileSystemCacheForDev: false,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'graph.microsoft.com' },
    ],
  },
};

export default nextConfig;
