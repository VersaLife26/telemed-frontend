import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TEST_MODE } from "@/lib/consumer/env";
import { TestConsole } from "@/components/test/TestConsole";

/**
 * The developer test surface.
 *
 * The 404 here is the second of two gates, not the only one: proxy.ts already
 * refuses the path when TEST_MODE is off, because the route table in
 * lib/surface-routes.ts is what decides a surface's reachable paths before any
 * page module runs. This one covers the case where that table is edited and
 * this check is not, and costs nothing.
 *
 * Neither gate is the real control. The backend's own TELEMED_TEST_MODE is --
 * these only decide whether the page renders, while that decides whether the
 * endpoints behind it exist at all.
 */
export const metadata: Metadata = {
  title: "Test console",
  // Belt and braces on a page that must never be indexed or linked from
  // anywhere. It should not be reachable in an environment a crawler can see,
  // and if it somehow is, this is one fewer way to find it.
  robots: { index: false, follow: false },
};

export default function TestPage() {
  if (!TEST_MODE) notFound();
  return <TestConsole />;
}
