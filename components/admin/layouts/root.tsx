import { headers } from "next/headers";

import { auth } from "@/auth";
import { AppProviders } from "@/components/admin/providers/app-providers";

/** The html/body frame for the admin console. */
export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const [session, requestHeaders] = await Promise.all([auth(), headers()]);
  // Set by proxy.ts; next-themes needs it to inline its no-flash script
  // under the same CSP nonce Next.js uses for its own bootstrap scripts.
  const nonce = requestHeaders.get("x-nonce") ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh bg-background text-foreground antialiased" data-surface="admin">
        <AppProviders session={session} nonce={nonce}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
