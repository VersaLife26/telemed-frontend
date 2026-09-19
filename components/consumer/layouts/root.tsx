import { Manrope, Plus_Jakarta_Sans } from "next/font/google";

import { SURFACE } from "@/lib/consumer/surface";

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

/**
 * The html/body frame for the patient and doctor surfaces.
 *
 * Kept out of app/layout.tsx and reached through a dynamic import so the admin
 * frame's module -- which constructs the Auth.js instance at import time and
 * needs AUTH_SECRET to do it -- is never evaluated in a consumer build.
 *
 * The font variables sit on <html>, not <body>: styles/consumer.css resolves
 * --family-display/--family-body at :root, and :root is <html>.
 */
export default function ConsumerRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${jakarta.variable}`}>
      <body className="antialiased" data-surface={SURFACE}>
        {children}
      </body>
    </html>
  );
}
