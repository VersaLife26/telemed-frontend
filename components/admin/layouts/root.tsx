import { headers } from "next/headers";

import { AppProviders } from "@/components/admin/providers/app-providers";

/** The html/body frame for the admin console. */
export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  // Set by proxy.ts; next-themes needs it to inline its no-flash script
  // under the same CSP nonce Next.js uses for its own bootstrap scripts.
  const nonce = requestHeaders.get("x-nonce") ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh bg-background text-foreground antialiased" data-surface="admin">
        <AppProviders nonce={nonce}>{children}</AppProviders>
      </body>
    </html>
  );
}
