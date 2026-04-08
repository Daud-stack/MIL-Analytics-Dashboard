import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Vercel on the default output path while using a separate local build dir
  // to avoid Windows/OneDrive locks on ".next".
  distDir: process.env.VERCEL ? ".next" : ".next-build",

  // Enable React strict mode for development
  reactStrictMode: true,

  // Image optimization
  images: {
    unoptimized: process.env.NODE_ENV === "development",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.avenues.clinic",
      },
    ],
  },

  // Environment variables
  env: {
    NEXT_PUBLIC_APP_NAME: "Avenues Clinic Intelligence Platform",
    NEXT_PUBLIC_APP_VERSION: "1.0.0",
  },

  // Turbopack configuration for Next.js 16
  turbopack: {},

  // Headers for security
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },

  // Redirects
  async redirects() {
    return [];
  },

  // Rewrites
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [],
    };
  },

  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,

  // Experimental features (if needed)
  experimental: {},
};

export default nextConfig;