import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Swagger UI requires its trailing slash so relative CSS/JS assets remain
  // under /api-docs instead of resolving at the site root.
  skipTrailingSlashRedirect: true,
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ];
  },
  async rewrites() {
    const apiBaseUrl =
      process.env.API_INTERNAL_URL ?? "http://localhost:4000";

    return [
      {
        source: "/api/:path*",
        destination: `${apiBaseUrl}/api/:path*`,
      },
      {
        source: "/api-docs/:path*",
        destination: `${apiBaseUrl}/api-docs/:path*`,
      },
      {
        source: "/openapi.json",
        destination: `${apiBaseUrl}/openapi.json`,
      },
    ];
  },
};

export default nextConfig;
