import Image from "next/image";

import { assets, stock } from "@/lib/consumer/assets";
import { Reveal } from "@/components/consumer/ui/Reveal";

export const AUTH_BLURB =
  "VersaLife Health. Consult trusted doctors online — anytime, anywhere in Sri Lanka.";

/**
 * The hero half of the sign-in frame: photograph, blue wash, and a frosted
 * card carrying the wordmark. The card used to draw the wordmark as text
 * inside two outlined pills -- a placeholder lockup -- where the real logo
 * belongs.
 */
export function AuthHeroPanel({ blurb = AUTH_BLURB }: { blurb?: string }) {
  return (
    <div className="relative flex min-h-[320px] flex-1 flex-col justify-end overflow-hidden rounded-xl p-5 lg:min-h-0 lg:p-8">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[image:var(--gradient-hero)]" />
        <Image src={stock.authHero} alt="" fill className="object-cover object-center" priority unoptimized />
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 via-blue-900/0 to-blue-900/55" />
      </div>

      <Reveal className="relative z-10">
        <div className="glass-panel-dark p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="relative size-11 shrink-0">
              <Image src={assets.logo} alt="" fill className="object-contain" />
            </span>
            <span className="text-h4 text-white">VersaLife Health</span>
          </div>
          <p className="mt-5 max-w-prose text-body-lg text-white/85">{blurb}</p>
        </div>
      </Reveal>
    </div>
  );
}
