import Image from "next/image";
import { assets } from "@/lib/consumer/assets";

export function AuthHeroPanel({
  blurb = "VersaLife Telemedicine. Consult trusted doctors online — anytime, anywhere in Sri Lanka.",
}: {
  blurb?: string;
}) {
  return (
    <div className="relative flex min-h-[320px] flex-1 flex-col items-center justify-end overflow-hidden rounded-[var(--radius-auth)] p-4 lg:min-h-0">
      <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[var(--radius-auth)]">
        <div className="absolute inset-0 rounded-[var(--radius-auth)] bg-bg-gray-300" />
        <div className="absolute inset-0 overflow-hidden rounded-[var(--radius-auth)]">
          <Image
            src={assets.heroImage}
            alt=""
            fill
            className="object-cover object-top"
            priority
          />
        </div>
        <div className="absolute inset-0 rounded-[var(--radius-auth)] bg-gradient-to-b from-white/30 via-white/0 via-[41.346%] to-[rgba(0,30,51,0.3)] to-[76.442%]" />
      </div>

      <div className="relative z-10 w-full rounded-[42px] bg-[rgba(248,248,248,0.8)] px-8 py-10 backdrop-blur-[16px] sm:px-10 sm:py-[50px]">
        <div className="flex items-center">
          <div className="mr-[-30px] size-[62px] shrink-0 rounded-full border border-text-label" />
          <div className="relative h-[62px] w-[241px] max-w-full overflow-hidden rounded-full border border-text-label">
            <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[20px] font-normal leading-[1.4] text-text-label">
              Versalife Health
            </p>
          </div>
        </div>
        <p className="mt-8 max-w-full text-[16px] font-normal leading-[1.8] text-text-label">
          {blurb}
        </p>
      </div>
    </div>
  );
}
