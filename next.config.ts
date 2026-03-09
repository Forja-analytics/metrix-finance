import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Prisma uses native binaries - must not be bundled by webpack
  serverExternalPackages: ['@prisma/client', 'prisma'],
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

export default nextConfig;
