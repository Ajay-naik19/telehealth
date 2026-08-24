import path from "node:path";
import { fileURLToPath } from "node:url";

const isProduction = process.env.NODE_ENV === "production";
const configuredBackend = process.env.NEXT_SERVER_API_URL;

if (isProduction && !configuredBackend) {
  throw new Error(
    "Missing NEXT_SERVER_API_URL in production. Refusing to fall back to localhost."
  );
}

const isLoopbackBackend = /^http:\/\/(localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i.test(
  configuredBackend || "",
);

if (isProduction && configuredBackend && configuredBackend.startsWith("http://") && !isLoopbackBackend) {
  throw new Error("NEXT_SERVER_API_URL must use HTTPS in production.");
}

const BACKEND = (configuredBackend || "http://localhost:10000").replace(/\/$/, "");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https://www.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async rewrites() {
    return [
      // Dedicated backend proxy prefix to avoid collisions with App Router pages.
      { source: "/backend/:path*", destination: `${BACKEND}/:path*` },

      // Catch-all for /api/* routes.
      { source: "/api/:path*", destination: `${BACKEND}/api/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: csp,
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
