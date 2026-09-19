import { headers } from "next/headers";
import { Manrope, Plus_Jakarta_Sans } from "next/font/google";

import { AppProviders } from "@/components/admin/providers/app-providers";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["200", "300", "400", "500", "600", "700"],
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["500", "600", "700", "800"],
});

/** The html/body frame for the admin console. */
export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  // Set by proxy.ts; next-themes needs it to inline its no-flash script
  // under the same CSP nonce Next.js uses for its own bootstrap scripts.
  const nonce = requestHeaders.get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${manrope.variable} ${jakarta.variable}`}
    >
      <body className="min-h-dvh bg-background text-foreground antialiased" data-surface="admin">
        <AppProviders nonce={nonce}>{children}</AppProviders>
      </body>
    </html>
  );
}
