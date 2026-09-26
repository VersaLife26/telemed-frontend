import assert from "node:assert/strict";
import test from "node:test";

import {
  WEEKDAYS,
  clockToMinute,
  hoursLine,
  minuteToClock,
  weekdayLabel,
} from "@/lib/consumer/features/availability";

test("weekday labels are Sun through Sat", () => {
  assert.deepEqual([...WEEKDAYS], ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  assert.equal(weekdayLabel(1), "Mon");
  assert.equal(weekdayLabel(9), "Day 9");
});

test("minutes from midnight round-trip through clock strings", () => {
  assert.equal(minuteToClock(540), "09:00");
  assert.equal(minuteToClock(825), "13:45");
  assert.equal(minuteToClock(1440), "24:00");
  assert.equal(clockToMinute("09:00"), 540);
  assert.equal(clockToMinute("13:45"), 825);
  assert.equal(clockToMinute("bad"), 0);
});

test("hoursLine shows the window as clock times", () => {
  assert.equal(hoursLine({ startMinute: 540, endMinute: 780 }), "09:00 – 13:00");
});
