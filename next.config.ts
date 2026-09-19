import type { NextConfig } from "next";

import { contentSecurityPolicy, staticSecurityHeaders } from "./lib/admin/security/csp";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // The admin bundle must not leak build metadata that helps someone
  // fingerprint the exact Next.js patch level.
  poweredByHeader: false,

  // NO `output: "standalone"`.
  //
  // Standalone produces .next/standalone/server.js -- a Node HTTP server --
  // which is exactly what a Worker is not. @opennextjs/cloudflare builds its
  // own bundle from the normal .next output, and standalone would either be
  // ignored or actively conflict with it.

  // Doctor credential scans come from MinIO presigned URLs. Routing them
  // through next/image would copy a NIC scan into the optimiser's on-disk
  // cache on every admin server, where it would outlive the presigned URL's
  // expiry. The document viewer uses plain <img>/<iframe> instead, so the
  // optimiser is switched off rather than left enabled and unused.
  // `remotePatterns` is not enforced while `unoptimized` is on -- the loader
  // is bypassed entirely -- but the editorial photography in
  // lib/consumer/assets.ts does come from this host, and recording it here
  // keeps the config honest if the optimiser is ever switched back on.
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },

  // Source maps in production would ship the admin console's route table and
  // API surface to anyone who opens DevTools on the login page.
  productionBrowserSourceMaps: false,

  // Note: there is no `eslint` key here. Next.js 16 removed `next lint` and
  // the build-time lint pass along with it; linting is `npm run lint`, which
  // runs eslint directly against eslint.config.mjs.

  async headers() {
    return [
      {
        // Every response gets the non-CSP security headers.
        source: "/:path*",
        headers: [...staticSecurityHeaders],
      },
      {
        // Static assets skip the proxy (see proxy.ts `matcher`), so
        // they need their own CSP. It is the nonce-free, strictly tighter
        // variant: these responses are never HTML.
        source: "/_next/static/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy({ dev: isDev }) },
        ],
      },
      {
        source: "/favicon.ico",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy({ dev: isDev }) },
        ],
      },
      {
        // Nothing under the BFF proxy or the auth routes may be cached by an
        // intermediary. These carry admin data and session material.
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, private" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
    ];
  },
};

export default nextConfig;
