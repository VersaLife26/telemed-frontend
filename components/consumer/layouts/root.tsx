import { SURFACE } from "@/lib/consumer/surface";
import { fontVariables } from "@/lib/shared/fonts";

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
    <html lang="en" className={fontVariables}>
      <body className="antialiased" data-surface={SURFACE}>
        {children}
      </body>
    </html>
  );
}
