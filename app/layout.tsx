import type { Metadata, Viewport } from "next";

import { SURFACE, type Surface } from "@/lib/consumer/surface";

import "./globals.css";

/**
 * The single root layout for all three surfaces.
 *
 * There can only be one: route groups organise files, they do not namespace
 * URLs, and Next allows multiple root layouts only when no two of them can
 * resolve the same path. All three surfaces publish `/`, `/login` and
 * `/appointments`, so they share one tree and branch on the surface this
 * deployment was built for.
 *
 * The branch is a dynamic import rather than a top-level one on purpose. The
 * admin frame imports `@/auth`, which builds the Auth.js instance at module
 * load and needs AUTH_SECRET; a static import would evaluate that in the
 * patient and doctor builds too, and fail there for a module they never use.
 */
const META: Record<Surface, Metadata> = {
  admin: {
    title: { default: "VersaLife Health · Admin", template: "%s · VersaLife Health" },
    description: "Operations console for the telemedicine platform.",
    // This console must never appear in a search index, and it is not a mobile
    // web app anyone should be able to install from a phishing page.
    robots: { index: false, follow: false, nocache: true },
    applicationName: "VersaLife Health Admin",
  },
  doctor: {
    title: { default: "VersaLife Health · Doctor", template: "%s · VersaLife Health" },
    description: "Consult patients online — availability, queue and earnings in one place.",
    applicationName: "VersaLife Health",
  },
  patient: {
    title: { default: "VersaLife Health", template: "%s · VersaLife Health" },
    description: "Consult trusted doctors online — anytime, anywhere in Sri Lanka.",
    applicationName: "VersaLife Health",
  },
};

export const metadata: Metadata = META[SURFACE];

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: SURFACE === "admin" ? "light dark" : "light",
  themeColor: SURFACE === "admin" ? "#015591" : "#ffffff",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (SURFACE === "admin") {
    const { default: AdminRootLayout } = await import("@/components/admin/layouts/root");
    return <AdminRootLayout>{children}</AdminRootLayout>;
  }
  const { default: ConsumerRootLayout } = await import("@/components/consumer/layouts/root");
  return <ConsumerRootLayout>{children}</ConsumerRootLayout>;
}
