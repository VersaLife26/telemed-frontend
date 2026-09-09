import { Manrope } from "next/font/google";

import { SURFACE } from "@/lib/consumer/surface";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["200", "300", "400", "500", "600", "700"],
});

/**
 * The html/body frame for the patient and doctor surfaces.
 *
 * Kept out of app/layout.tsx and reached through a dynamic import so the admin
 * frame's module -- which constructs the Auth.js instance at import time and
 * needs AUTH_SECRET to do it -- is never evaluated in a consumer build.
 */
export default function ConsumerRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} antialiased`} data-surface={SURFACE}>
        {children}
      </body>
    </html>
  );
}
