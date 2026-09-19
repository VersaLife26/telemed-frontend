import type { Slot } from "@/lib/consumer/api/types";

/** Backend ListSlots already filters AVAILABLE; this is the client-side belt. */
export function isOpenSlot(slot: Slot): boolean {
  return (slot.status || "AVAILABLE").toUpperCase() === "AVAILABLE";
}

/** First day that still has a bookable slot, else the first day in the window. */
export function firstOpenDay(days: { date: string; slots: Slot[] }[]): string | undefined {
  return days.find((day) => day.slots.some(isOpenSlot))?.date ?? days[0]?.date;
}
