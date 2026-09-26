import assert from "node:assert/strict";
import test from "node:test";

import {
  DAYS,
  dayError,
  initialSettings,
  minutesToTime,
  timeToMinutes,
  toRows,
  toScheduleRequest,
} from "@/lib/admin/schedule";

test("minutes from midnight round-trip through the time inputs", () => {
  assert.equal(minutesToTime(0), "00:00");
  assert.equal(minutesToTime(9 * 60 + 30), "09:30");
  assert.equal(timeToMinutes("17:45"), 17 * 60 + 45);
  assert.equal(timeToMinutes(minutesToTime(780)), 780);
  // 1440 is a valid end of day on the wire but not a valid <input type="time">.
  assert.equal(minutesToTime(1440), "23:59");
});

test("toRows places each day at its own index, and absent days are off", () => {
  const rows = toRows([
    { dayOfWeek: 4, startMinute: 540, endMinute: 780 },
    { dayOfWeek: 0, startMinute: 600, endMinute: 720 },
  ]);
  assert.equal(rows.length, DAYS.length);
  assert.deepEqual(rows[4], { available: true, start: "09:00", end: "13:00" });
  assert.deepEqual(rows[0], { available: true, start: "10:00", end: "12:00" });
  assert.equal(rows[1]?.available, false);
});

// An out-of-range dayOfWeek would otherwise extend the array and render a
// row for a weekday that does not exist.
test("toRows ignores an out-of-range day", () => {
  const rows = toRows([
    { dayOfWeek: 9, startMinute: 540, endMinute: 600 },
    { dayOfWeek: -1, startMinute: 540, endMinute: 600 },
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

// The API replaces the whole week, so a day that is off is simply absent.
test("only working days are sent, with every setting the PUT requires", () => {
  const rows = toRows([{ dayOfWeek: 2, startMinute: 480, endMinute: 720 }]);
  const body = toScheduleRequest(
    rows,
    initialSettings({ slotDurationMinutes: 20, bufferMinutes: 0, timezone: "Asia/Colombo" }),
  );
  assert.deepEqual(body.workingHours, [{ dayOfWeek: 2, startMinute: 480, endMinute: 720 }]);
  assert.equal(body.slotDurationMinutes, 20);
  // 0 is back-to-back and must survive, not be replaced by a default.
  assert.equal(body.bufferMinutes, 0);
  assert.equal(body.maxPerDay, 0);
  assert.equal(typeof body.advanceDays, "number");
  assert.equal(body.timezone, "Asia/Colombo");
});
