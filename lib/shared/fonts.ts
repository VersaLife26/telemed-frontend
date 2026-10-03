import { Manrope, Plus_Jakarta_Sans } from "next/font/google";

/**
 * Shared self-hosted Google fonts for every surface.
 *
 * Loaded as variable fonts (no discrete `weight` list) so Turbopack’s
 * production build emits one face per family — discrete weights trigger
 * “next/font/google queries have exactly one entry” on Next 16.
 */
export const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const fontVariables = `${manrope.variable} ${jakarta.variable}`;
