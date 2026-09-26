import type { Slot } from "@/lib/consumer/api/types";

export type SlotDay = { date: string; slots: Slot[] };

/** One call covers the whole window; the API trims it to the doctor's advance-booking days. */
export function slotsPath(doctorId: string, from: string, to: string): string {
  return `/doctors/${doctorId}/slots?${new URLSearchParams({ from, to })}`;
}

export function isOpenSlot(slot: Slot): boolean {
  return slot.available;
}

/** yyyy-mm-dd for the calendar day an instant falls on in `timeZone`. */
export function slotDayKey(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** Open slots bucketed onto `dates` by the day they fall on in the doctor's zone. */
export function slotsByDay(dates: string[], slots: Slot[], timeZone: string): SlotDay[] {
  const days = dates.map((date) => ({ date, slots: [] as Slot[] }));
  const byDate = new Map(days.map((day) => [day.date, day]));
  for (const slot of slots) {
    if (!isOpenSlot(slot)) continue;
    byDate.get(slotDayKey(slot.startAt, timeZone))?.slots.push(slot);
  }
  return days;
}

/** First day that still has a bookable slot, else the first day in the window. */
export function firstOpenDay(days: SlotDay[]): string | undefined {
  return days.find((day) => day.slots.some(isOpenSlot))?.date ?? days[0]?.date;
}
