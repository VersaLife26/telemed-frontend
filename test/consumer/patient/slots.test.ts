import assert from "node:assert/strict";
import test from "node:test";

import type { Slot } from "@/lib/consumer/api/types";
import { firstOpenDay, isOpenSlot } from "@/lib/consumer/features/slots";

function slot(id: string, status?: string): Slot {
  return { id, doctor_id: "d", start_at: "2026-09-21T04:00:00Z", end_at: "2026-09-21T04:30:00Z", status };
}

test("isOpenSlot treats missing status as available", () => {
  assert.equal(isOpenSlot(slot("a", "AVAILABLE")), true);
  assert.equal(isOpenSlot(slot("b")), true);
  assert.equal(isOpenSlot(slot("c", "BOOKED")), false);
});

test("firstOpenDay skips empty days so evening today still finds Monday", () => {
  assert.equal(
    firstOpenDay([
      { date: "2026-09-19", slots: [] },
      { date: "2026-09-20", slots: [] },
      { date: "2026-09-21", slots: [slot("mon")] },
    ]),
    "2026-09-21",
  );
  assert.equal(firstOpenDay([{ date: "2026-09-19", slots: [] }]), "2026-09-19");
});
