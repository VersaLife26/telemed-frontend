import assert from "node:assert/strict";
import test from "node:test";

import type { Slot } from "@/lib/consumer/api/types";
import { firstOpenDay, isOpenSlot, slotDayKey, slotsByDay, slotsPath } from "@/lib/consumer/features/slots";

function slot(startAt: string, available = true): Slot {
  return { startAt, endAt: startAt, available };
}

test("slotsPath asks for the whole window in one call", () => {
  assert.equal(slotsPath("doc-1", "2026-09-19", "2026-10-02"), "/doctors/doc-1/slots?from=2026-09-19&to=2026-10-02");
});

test("isOpenSlot follows the available flag", () => {
  assert.equal(isOpenSlot(slot("2026-09-21T04:00:00Z")), true);
  assert.equal(isOpenSlot(slot("2026-09-21T04:00:00Z", false)), false);
});

test("slotDayKey uses the doctor's zone, not UTC", () => {
  assert.equal(slotDayKey("2026-09-20T20:00:00Z", "Asia/Colombo"), "2026-09-21");
  assert.equal(slotDayKey("2026-09-20T20:00:00Z", "UTC"), "2026-09-20");
});

test("slotsByDay buckets open slots onto the window's days", () => {
  const days = slotsByDay(
    ["2026-09-20", "2026-09-21"],
    [
      slot("2026-09-20T04:00:00Z"),
      slot("2026-09-20T04:30:00Z", false),
      slot("2026-09-20T20:00:00Z"),
      slot("2026-09-25T04:00:00Z"),
    ],
    "Asia/Colombo",
  );
  assert.deepEqual(
    days.map((day) => [day.date, day.slots.map((s) => s.startAt)]),
    [
      ["2026-09-20", ["2026-09-20T04:00:00Z"]],
      ["2026-09-21", ["2026-09-20T20:00:00Z"]],
    ],
  );
});

test("firstOpenDay skips empty days so evening today still finds Monday", () => {
  assert.equal(
    firstOpenDay([
      { date: "2026-09-19", slots: [] },
      { date: "2026-09-20", slots: [] },
      { date: "2026-09-21", slots: [slot("2026-09-21T04:00:00Z")] },
    ]),
    "2026-09-21",
  );
  assert.equal(firstOpenDay([{ date: "2026-09-19", slots: [] }]), "2026-09-19");
});
