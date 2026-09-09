import assert from "node:assert/strict";
import test from "node:test";

import {
  DAYS,
  bufferValue,
  dayError,
  initialBuffer,
  toAvailabilityRequest,
  toRows,
} from "@/lib/admin/schedule";

// The distinction this whole field exists to preserve. 0 means back-to-back
// consultations, which is a real instruction; blank means "never set, use the
// default". They travel as 0 and null all the way to the column and the event
// tag, and collapsing them here would hand that doctor the default gap forever
// with nothing logged to say why.
test("a blank buffer is null and a zero buffer is zero", () => {
  assert.equal(bufferValue(""), null);
  assert.equal(bufferValue("   "), null);
  assert.equal(bufferValue("0"), 0);
  assert.equal(bufferValue("10"), 10);
});

test("the buffer round-trips through the editor unchanged", () => {
  assert.equal(initialBuffer({ slot_duration_minutes: 15, buffer_minutes: 0, max_per_day: 0 }), "0");
  assert.equal(
    initialBuffer({ slot_duration_minutes: 15, buffer_minutes: null, max_per_day: 0 }),
    "",
  );
  // 0 -> "0" -> 0, not 0 -> "0" -> null.
  assert.equal(
    bufferValue(initialBuffer({ slot_duration_minutes: 15, buffer_minutes: 0, max_per_day: 0 })),
    0,
  );
});

test("toRows places each day at its own index", () => {
  const rows = toRows([
    { day_of_week: 4, start_time: "09:00", end_time: "13:00", is_available: true },
    { day_of_week: 0, start_time: "10:00:00", end_time: "12:00:00", is_available: true },
  ]);
  assert.equal(rows.length, DAYS.length);
  assert.deepEqual(rows[4], { available: true, start: "09:00", end: "13:00" });
  // Seconds are trimmed: <input type="time"> rejects HH:MM:SS.
  assert.deepEqual(rows[0], { available: true, start: "10:00", end: "12:00" });
  assert.equal(rows[1]?.available, false);
});

// An out-of-range day_of_week would otherwise extend the array and render a
// row for a weekday that does not exist.
test("toRows ignores an out-of-range day", () => {
  const rows = toRows([
    { day_of_week: 9, start_time: "09:00", end_time: "10:00", is_available: true },
    { day_of_week: -1, start_time: "09:00", end_time: "10:00", is_available: true },
  ]);
  assert.equal(rows.length, DAYS.length);
  assert.ok(rows.every((r) => !r.available));
});

test("a day that is on must describe a forward interval", () => {
  assert.equal(dayError({ available: false, start: "17:00", end: "09:00" }), null);
  assert.ok(dayError({ available: true, start: "17:00", end: "09:00" }));
  assert.ok(dayError({ available: true, start: "09:00", end: "09:00" }));
  assert.equal(dayError({ available: true, start: "09:00", end: "17:00" }), null);
});

// Days that are off are still sent, carrying is_available: false. The backend
// upserts the whole week, so omitting them would leave a previously-worked day
// silently in place.
test("every day is sent, including the ones that are off", () => {
  const rows = toRows([
    { day_of_week: 2, start_time: "08:00", end_time: "12:00", is_available: true },
  ]);
  const body = toAvailabilityRequest(rows, 15, "0", 0);
  assert.equal(body.working_hours.length, 7);
  assert.deepEqual(
    body.working_hours.map((h) => h.day_of_week),
    [0, 1, 2, 3, 4, 5, 6],
  );
  assert.equal(body.working_hours[2]?.is_available, true);
  assert.equal(body.working_hours[3]?.is_available, false);
  assert.equal(body.buffer_minutes, 0);
});
