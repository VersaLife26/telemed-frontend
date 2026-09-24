"use client";

import { useEffect, useRef, useState } from "react";

import { cx } from "@/lib/consumer/cx";

/**
 * Scroll-triggered fade-up. Used on the sign-in and registration pages only.
 *
 * It is deliberately absent from the signed-in app: an animation someone sees
 * ten times a day stops reading as polish and starts reading as latency. The
 * app shell spends its motion budget on press and state feedback instead.
 */
export function Reveal({
  children,
  delay = 0,
  index,
  className,
}: {
  children: React.ReactNode;
  /** Stagger index, not milliseconds. Multiplied by --stagger-step (40ms). */
  delay?: number;
  /** Position in a staggered group; 40ms per step. Takes precedence over `delay`. */
  index?: number;
  className?: string;
}) {
  const step = index ?? delay;
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "-40px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `calc(var(--stagger-step) * ${step})` }}
      className={cx(
        "transition-[opacity,translate] duration-[var(--dur-slow)] ease-out motion-reduce:transition-none",
        shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0 motion-reduce:opacity-100",
        className,
      )}
    >
      {children}
    </div>
  );
}
