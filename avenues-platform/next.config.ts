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

  turbopack: {},

  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          ...(Array.isArray(config.watchOptions?.ignored)
            ? config.watchOptions.ignored
            : config.watchOptions?.ignored
              ? [config.watchOptions.ignored]
              : []),
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
