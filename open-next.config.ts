import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext's Cloudflare adapter configuration.
 *
 * Deliberately minimal, and it can be, because this app avoids the two things
 * that usually make an adapter configuration complicated:
 *
 *   - NO incremental cache. There is not a single `revalidate`,
 *     `revalidateTag`, `unstable_cache` or `generateStaticParams` in the app,
 *     and `app/(app)/layout.tsx` is `force-dynamic`. Every authenticated page
 *     is server-rendered per request, so there is no ISR cache to back with
 *     KV or R2.
 *   - NO image optimizer. `next.config.ts` sets `images.unoptimized` because
 *     routing a doctor's NIC scan through the optimiser would copy it into an
 *     on-disk cache that outlives the presigned URL's expiry.
 *
 * The middleware (`proxy.ts`) declares no runtime, so it runs on the edge
 * runtime, which this adapter supports. That is why `lib/admin/proxy-impl.ts`
 * builds its Auth.js instance from `authConfig` rather than importing the full
 * `@/auth` -- see the comment there.
 *
 * `buildCommand` is `next build` on purpose. Cloudflare Workers Builds and
 * `npm run build` both invoke `opennextjs-cloudflare build`. If that in turn
 * ran the npm `build` script, the two would recurse. The surface stylesheet
 * is still selected first: npm's `prebuild` on the outer call, and
 * select-surface.mjs here so `npm run cf:build` (no prebuild) stays correct.
 */
export default {
  ...defineCloudflareConfig(),
  buildCommand: "node scripts/select-surface.mjs && npx next build",
};
