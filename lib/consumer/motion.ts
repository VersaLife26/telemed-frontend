import type { Transition } from "motion/react";

export const spring = { type: "spring", bounce: 0, duration: 0.35 } satisfies Transition;
export const springSnappy = { type: "spring", bounce: 0, duration: 0.25 } satisfies Transition;
export const springFlick = { type: "spring", bounce: 0.2, duration: 0.4 } satisfies Transition;

/**
 * Where a flick would come to rest under UIScrollView-style deceleration.
 * `velocity` is in px/s, as motion's `getVelocity()` reports it.
 */
export function project(velocity: number, decel = 0.998) {
  return ((velocity / 1000) * decel) / (1 - decel);
}

/** UIScrollView's rubber-band: resistance grows as the overshoot approaches `dimension`. */
export function rubberband(overshoot: number, dimension: number, c = 0.55) {
  const sign = Math.sign(overshoot);
  const x = Math.abs(overshoot);
  return sign * (1 - 1 / ((x * c) / dimension + 1)) * dimension;
}
