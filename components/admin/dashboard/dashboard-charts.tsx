"use client";

/**
 * Re-export chart components for the dashboard page.
 *
 * Charts are already `"use client"` modules. Wrapping them in `next/dynamic`
 * with `ssr: false` left CardSkeleton painted forever under Next.js 16 —
 * import them directly instead.
 */
export { RevenueChart as DashboardRevenueChart } from "@/components/admin/charts/revenue-chart";
export { BookingsChart as DashboardBookingsChart } from "@/components/admin/charts/bookings-chart";
