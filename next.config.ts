import type { NextConfig } from "next";

// Security headers on every response (SCRUM-213). Checked with securityheaders.com after deploy.
const isProd = process.env.NODE_ENV === "production";
// HTTPS-only rules apply on Vercel (bookwrms.store), not to `pnpm start` on http://localhost
const isHosted = !!process.env.VERCEL;
const csp = [
  "default-src 'self'",
  // Next.js needs inline scripts for hydration; dev mode also needs eval. Vercel's preview
  // toolbar loads from vercel.live on preview deployments.
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"} https://vercel.live`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://cdn.shopify.com https://vercel.live https://vercel.com",
  "font-src 'self' data: https://vercel.live",
  "connect-src 'self' https://vercel.live wss://ws-us3.pusher.com",
  "frame-src https://vercel.live",
  "frame-ancestors 'none'",
  "form-action 'self' https://checkout.stripe.com",
  "base-uri 'self'",
  "object-src 'none'",
  ...(isHosted ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Class project, not a real store: keep it out of search results
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  ...(isHosted ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  experimental: {
    agentUpgrade: "security",
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
  remotePatterns: [
    { protocol: "https", hostname: "cdn.shopify.com" },
    ],
  },
};

export default nextConfig;
