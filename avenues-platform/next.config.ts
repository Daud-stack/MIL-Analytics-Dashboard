import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.VERCEL ? ".next" : ".next-build",
  reactStrictMode: true,

  images: {
    unoptimized: process.env.NODE_ENV === "development",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.avenues.clinic",
      },
    ],
  },

  env: {
    NEXT_PUBLIC_APP_NAME: "Avenues Clinic Intelligence Platform",
    NEXT_PUBLIC_APP_VERSION: "1.0.0",
    NEXT_PUBLIC_ALLOW_SELF_REGISTRATION:
      process.env.ALLOW_SELF_REGISTRATION === "true" ? "true" : "false",
  },

  // Let Turbopack infer the workspace root. This is correct now that the
  // vestigial package-lock.json in the parent folder has been removed —
  // explicit root pinning proved unreliable on Windows (the compiled config's
  // __dirname pointed outside the app and broke Tailwind resolution).
  turbopack: {},

  webpack: (config, { dev }) => {
    if (dev) {
      // webpack's schema requires `ignored` to be all-strings (globs) or a
      // single RegExp — Next's default is a RegExp, so mixing it into an
      // array fails validation. Keep only string entries and re-add
      // node_modules explicitly.
      const existing = config.watchOptions?.ignored;
      const existingStrings = Array.isArray(existing)
        ? existing.filter((e: unknown): e is string => typeof e === 'string')
        : typeof existing === 'string'
          ? [existing]
          : [];
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          ...existingStrings,
          '**/node_modules/**',
          '**/data/**',
          '**/uploads/**',
          '**/archived/**',
          '**/scripts/**',
        ],
      };
    }
    return config;
  },

  async headers() {
    const securityHeaders = [
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "X-Frame-Options",
        value: "DENY",
      },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "Permissions-Policy",
        value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
      },
      {
        key: "Cross-Origin-Opener-Policy",
        value: "same-origin",
      },
      {
        key: "Cross-Origin-Resource-Policy",
        value: "same-origin",
      },
      {
        key: "Origin-Agent-Cluster",
        value: "?1",
      },
      {
        key: "X-DNS-Prefetch-Control",
        value: "off",
      },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
    ];

    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  async redirects() {
    return [];
  },

  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [],
    };
  },

  compress: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  experimental: {},
};

export default nextConfig;
