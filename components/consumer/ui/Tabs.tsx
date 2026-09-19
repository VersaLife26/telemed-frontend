"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { cx } from "@/lib/consumer/cx";

export type TabItem<T extends string> = { value: T; label: string };

/**
 * Pill segmented control.
 *
 * The active pill is a duplicate of the whole row -- brand background, white
 * text -- clipped to the active tab's box. Animating the clip moves the pill
 * and the text-colour boundary as one edge, which is something you cannot get
 * by transitioning each tab's own colour: that always shows two tabs
 * mid-crossfade. The clip transitions with ease-in-out because it is movement
 * across the screen rather than something entering it.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: ReadonlyArray<TabItem<T>>;
  value: T;
  onChange: (next: T) => void;
  /** Accessible name for the tab list. */
  label: string;
  className?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef(new Map<string, HTMLButtonElement>());
  const [clip, setClip] = useState<string>("inset(0 100% 0 0 round 999px)");

  const measure = useCallback(() => {
    const list = listRef.current;
    const active = buttonsRef.current.get(value);
    if (!list || !active) return;
    const right = list.clientWidth - active.offsetLeft - active.offsetWidth;
    const bottom = list.clientHeight - active.offsetTop - active.offsetHeight;
    setClip(
      `inset(${active.offsetTop}px ${right}px ${bottom}px ${active.offsetLeft}px round 999px)`,
    );
  }, [value]);

  useLayoutEffect(measure, [measure]);

  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [measure]);

  function onKeyDown(event: React.KeyboardEvent) {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const index = items.findIndex((item) => item.value === value);
    const next = items[(index + delta + items.length) % items.length];
    if (!next) return;
    onChange(next.value);
    buttonsRef.current.get(next.value)?.focus();
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cx("relative inline-flex gap-1 rounded-pill bg-tint p-1", className)}
    >
      {items.map((item) => (
        <button
          key={item.value}
          ref={(node) => {
            if (node) buttonsRef.current.set(item.value, node);
            else buttonsRef.current.delete(item.value);
          }}
          type="button"
          role="tab"
          aria-selected={item.value === value}
          tabIndex={item.value === value ? 0 : -1}
          onClick={() => onChange(item.value)}
          className="relative z-10 min-h-9 cursor-pointer rounded-pill px-5 text-label text-muted transition-colors duration-[160ms] ease-out can-hover:hover:text-ink"
        >
          {item.label}
        </button>
      ))}

      <div
        aria-hidden="true"
        style={{ clipPath: clip }}
        className="pointer-events-none absolute inset-0 z-20 flex gap-1 bg-brand p-1 text-on-brand [transition:clip-path_220ms_var(--ease-in-out)]"
      >
        {items.map((item) => (
          <span
            key={item.value}
            className="flex min-h-9 items-center px-5 text-label"
          >
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
