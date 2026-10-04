"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/consumer/ui/Button";
import { cx } from "@/lib/consumer/cx";
import {
  REPLAY_GUIDE_EVENT,
  clearGuideSeen,
  guideSteps,
  readGuideSeen,
  resolveGuideSteps,
  shouldAutoStartGuide,
  writeGuideSeen,
  type GuideStep,
  type GuideSurface,
} from "@/lib/consumer/features/guide-tour";
import { SURFACE } from "@/lib/consumer/surface";

type Box = { top: number; left: number; width: number; height: number };

function isGuideSurface(surface: string): surface is GuideSurface {
  return surface === "patient" || surface === "doctor";
}

function findTourTarget(id: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`);
  let best: HTMLElement | null = null;
  let bestArea = 0;
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    const area = rect.width * rect.height;
    if (area > bestArea) {
      best = node;
      bestArea = area;
    }
  }
  return best;
}

function targetBox(node: HTMLElement): Box {
  const rect = node.getBoundingClientRect();
  const pad = 6;
  const top = Math.max(8, rect.top - pad);
  const left = Math.max(8, rect.left - pad);
  const right = Math.min(window.innerWidth - 8, rect.right + pad);
  const bottom = Math.min(window.innerHeight - 8, rect.bottom + pad);
  return { top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

export function GuideTour() {
  const pathname = usePathname();
  const surface = isGuideSurface(SURFACE) ? SURFACE : null;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [resolved, setResolved] = useState<GuideStep[]>([]);
  const [spot, setSpot] = useState<Box | null>(null);
  const [card, setCard] = useState({ width: 320, height: 220 });
  const cardRef = useRef<HTMLDivElement>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (!surface) return;
    const active = surface;
    function replay() {
      try {
        clearGuideSeen(localStorage, active);
      } catch {
        /* storage can be blocked; the guide still opens for this visit */
      }
      setStep(0);
      setOpen(true);
    }
    window.addEventListener(REPLAY_GUIDE_EVENT, replay);
    return () => window.removeEventListener(REPLAY_GUIDE_EVENT, replay);
  }, [surface]);

  useEffect(() => {
    if (!surface || open || attempted.current) return;
    let seen = true;
    try {
      seen = readGuideSeen(localStorage, surface);
    } catch {
      seen = true;
    }
    if (!shouldAutoStartGuide(surface, pathname, seen)) return;
    const timer = window.setTimeout(() => {
      attempted.current = true;
      setOpen(true);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [surface, pathname, open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.dispatchEvent(new Event("telemed:close-more"));
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") finish();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, surface]);

  useLayoutEffect(() => {
    const node = cardRef.current;
    if (!node) return;
    const box = node.getBoundingClientRect();
    setCard((prev) =>
      Math.abs(prev.width - box.width) > 1 || Math.abs(prev.height - box.height) > 1
        ? { width: box.width, height: box.height }
        : prev,
    );
  }, [open, step, resolved, spot]);

  useLayoutEffect(() => {
    if (!open || !surface) return;
    const active = surface;
    function measure() {
      const next = resolveGuideSteps(guideSteps(active), (id) => findTourTarget(id) !== null);
      if (next.length === 0) {
        setOpen(false);
        return;
      }
      setResolved(next);
      const index = next.length === 0 ? 0 : Math.min(step, next.length - 1);
      if (next.length > 0 && step > next.length - 1) setStep(index);
      const current = next[index];
      const node = current ? findTourTarget(current.target) : null;
      setSpot(node ? targetBox(node) : null);
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, step, surface]);

  function finish() {
    if (surface) {
      try {
        writeGuideSeen(localStorage, surface);
      } catch {
        /* a blocked store just means the guide may appear again */
      }
    }
    setOpen(false);
    setStep(0);
  }

  if (!surface || !open) return null;

  const index = resolved.length === 0 ? 0 : Math.min(step, resolved.length - 1);
  const current = resolved[index];
  if (!current) return null;
  const last = index >= resolved.length - 1;
  const place = cardPosition(spot, card);

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-labelledby="guide-title">
      <div className="absolute inset-0" />
      {spot ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute border border-white/90 shadow-[0_0_0_9999px_rgb(8_28_48/0.62)]"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
            borderRadius: Math.abs(spot.width - spot.height) < 12 ? 999 : 18,
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[rgb(8_28_48/0.62)]" />
      )}
      <div
        ref={cardRef}
        className="absolute w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border-default bg-surface p-5 text-ink shadow-brand"
        style={place}
      >
        <p className="text-[0.75rem] font-semibold tracking-[0.08em] text-brand uppercase">
          Guide · {index + 1} of {resolved.length}
        </p>
        <h2 id="guide-title" className="font-display mt-1 text-xl font-semibold tracking-tight">
          {current.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{current.body}</p>
        <div className="mt-4 flex gap-1" aria-hidden="true">
          {resolved.map((item, itemIndex) => (
            <span
              key={item.id}
              className={cx("h-1 flex-1 rounded-full", itemIndex <= index ? "bg-brand" : "bg-tint")}
            />
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={finish}>
            Skip
          </Button>
          <div className="flex gap-2">
            {index > 0 ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setStep(index - 1)}>
                Back
              </Button>
            ) : null}
            <Button type="button" size="sm" onClick={() => (last ? finish() : setStep(index + 1))}>
              {last ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReplayGuideButton() {
  if (!isGuideSurface(SURFACE)) return null;
  return (
    <Button
      type="button"
      variant="outline"
      fullWidth
      onClick={() => window.dispatchEvent(new Event(REPLAY_GUIDE_EVENT))}
    >
      Show guide again
    </Button>
  );
}

function cardPosition(spot: Box | null, card: { width: number; height: number }): {
  top: number | string;
  left: number | string;
  transform?: string;
} {
  const margin = 16;
  if (!spot) {
    return { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const belowTop = spot.top + spot.height + 14;
  const aboveTop = spot.top - 14 - card.height;
  const placeBelow = belowTop + card.height <= vh - margin || aboveTop < margin;
  let top = placeBelow ? belowTop : Math.max(margin, aboveTop);
  top = Math.min(top, vh - card.height - margin);
  top = Math.max(margin, top);
  let left = spot.left + spot.width / 2 - card.width / 2;
  left = Math.min(Math.max(margin, left), vw - card.width - margin);
  return { top, left };
}
