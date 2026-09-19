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
  className,
}: {
  children: React.ReactNode;
  /** Stagger index, not milliseconds. Multiplied by --stagger-step. */
  delay?: number;
  className?: string;
}) {
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
      style={{ transitionDelay: `calc(var(--stagger-step) * ${delay})` }}
      className={cx(
        "transition-[opacity,transform] duration-[600ms] ease-out motion-reduce:transition-none",
        shown ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0 motion-reduce:opacity-100",
        className,
      )}
    >
      {children}
    </div>
  );
}
