import Image from "next/image";
import type { ReactNode } from "react";

import { cx } from "@/lib/consumer/cx";
import type { HeroQuote } from "@/lib/consumer/heroes";

/**
 * The band every main page opens with: title and a quote on the left, a warm
 * photo on the right, on the hero gradient. It runs full-bleed and under the
 * transparent top bar (see `.page-hero`), so the first screen reads as a place
 * rather than as a form with a heading.
 *
 * `overlap` straddles the band's bottom edge -- the page's primary control
 * (a search bar, the next visit, today's slots) gets its own plane instead of
 * being one more card in the stack below.
 */
export function PageHero({
  eyebrow,
  title,
  lede,
  quote,
  image,
  imageAlt = "",
  framed = false,
  chips,
  children,
  overlap,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  quote: HeroQuote;
  /** Omit for a text-only band. */
  image?: string;
  imageAlt?: string;
  /**
   * For a photo with its own background (a doctor's uploaded portrait): show
   * it in a rounded frame. The default expects a transparent cutout, which
   * stands on the band's bottom edge with the gradient showing around it.
   */
  framed?: boolean;
  chips?: ReactNode;
  children?: ReactNode;
  overlap?: ReactNode;
}) {
  return (
    <>
      <section className="page-hero">
        <div aria-hidden="true" className="hero-pattern" />
        <div
          className={cx(
            "mx-auto grid w-full max-w-6xl gap-10 px-4 pt-[calc(var(--nav-h)+2.5rem)] md:px-8",
            image && "lg:grid-cols-[1.1fr_0.9fr] lg:items-end",
          )}
        >
          <div className={cx("hero-in min-w-0 self-center", overlap ? "pb-24" : "pb-12")}>
            <div className="flex items-center gap-4">
              {image ? (
                <div
                  className={cx(
                    "relative size-20 shrink-0 overflow-hidden lg:hidden",
                    framed ? "rounded-lg shadow-md" : "rounded-full bg-white/60 ring-4 ring-white/50",
                  )}
                >
                  <Image
                    src={image}
                    alt=""
                    fill
                    sizes="80px"
                    className={framed ? "object-cover" : "object-cover object-top"}
                    unoptimized
                  />
                </div>
              ) : null}
              <div className="min-w-0">
                {eyebrow ? <p className="text-eyebrow text-brand">{eyebrow}</p> : null}
                <h1 className="mt-2 text-h1 text-ink">{title}</h1>
              </div>
            </div>
            {lede ? <p className="mt-4 max-w-xl text-body-lg text-blue-900/75">{lede}</p> : null}

            <figure className="relative mt-7 max-w-xl border-l-2 border-brand/60 pl-5">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -top-5 left-3 font-display text-[4.5rem] leading-none text-brand/15"
              >
                “
              </span>
              <blockquote className="text-body-lg italic text-blue-900/85">{quote.text}</blockquote>
              <figcaption className="mt-2 text-caption text-muted">— {quote.author}</figcaption>
            </figure>

            {children ? <div className="mt-7">{children}</div> : null}

            {/* Below lg the photo is a thumbnail, and without a photo there is
                nothing to pin to at all, so the chips sit in the flow. */}
            {chips ? (
              <div className={cx("mt-7 flex flex-wrap gap-3", image && "lg:hidden")}>{chips}</div>
            ) : null}
          </div>

          {!image ? null : framed ? (
            <div
              className={cx(
                "hero-photo-in relative hidden self-center justify-self-end lg:block",
                overlap ? "pb-24" : "pb-12",
              )}
            >
              <div className="relative aspect-[4/5] h-[340px] overflow-hidden rounded-xl shadow-lg ring-4 ring-white/50">
                <Image
                  src={image}
                  alt={imageAlt}
                  fill
                  sizes="280px"
                  className="object-cover"
                  unoptimized
                  priority
                />
              </div>
              {chips ? (
                <div className="absolute -left-16 bottom-16 flex flex-col items-start gap-3">
                  {chips}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="hero-photo-in relative hidden h-[420px] lg:block">
              {/* A soft disc of light behind the figure, as in the kit: it
                  lifts the cutout off the gradient without drawing a box. */}
              <div
                aria-hidden="true"
                className="absolute bottom-0 left-1/2 size-[380px] -translate-x-1/2 translate-y-1/4 rounded-full bg-white/45 blur-2xl"
              />
              <Image
                src={image}
                alt={imageAlt}
                fill
                sizes="420px"
                className="object-contain object-bottom drop-shadow-[0_20px_30px_oklch(24%_0.05_258/0.18)]"
                unoptimized
                priority
              />
              {chips ? (
                <div
                  className={cx(
                    "absolute -left-10 flex flex-col items-start gap-3",
                    overlap ? "bottom-28" : "bottom-16",
                  )}
                >
                  {chips}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>

      {overlap ? <div className="relative z-10 -mt-16">{overlap}</div> : null}
    </>
  );
}

/** A frosted trust chip pinned to the hero photo: icon, value, label. */
export function HeroChip({
  icon,
  value,
  label,
  className,
}: {
  icon: ReactNode;
  value: ReactNode;
  label?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "glass-panel flex items-center gap-3 rounded-pill bg-white/85 py-2 pl-2 pr-5",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand shadow-brand"
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-h5 text-ink tabular-time">{value}</span>
        {label ? <span className="block text-caption text-muted">{label}</span> : null}
      </span>
    </div>
  );
}
