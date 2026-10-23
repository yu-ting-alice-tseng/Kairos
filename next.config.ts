import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@libsql/client', '@prisma/adapter-libsql', '@prisma/client'],
  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
    // Google Drive sync drops desktop.ini files into .next/dev/cache/turbopack/,
    // which corrupts Turbopack's persistent cache and crashes `next dev` on startup.
    turbopackFileSystemCacheForDev: false,
  },
  // The compressed images in /img never change in place (a new version gets a
  // new name), so browsers can keep them instead of asking again on every visit
  async headers() {
    return [{ source: '/img/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] }]
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
