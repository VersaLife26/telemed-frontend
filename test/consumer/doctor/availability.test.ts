import assert from "node:assert/strict";
import test from "node:test";

import { WEEKDAYS, hoursLine, weekdayLabel } from "@/lib/consumer/features/availability";

test("weekday labels are Sun through Sat", () => {
  assert.deepEqual([...WEEKDAYS], ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  assert.equal(weekdayLabel(1), "Mon");
  assert.equal(weekdayLabel(9), "Day 9");
});

test("hoursLine shows the interval or Unavailable", () => {
  assert.equal(
    hoursLine({ is_available: true, start_time: "09:00", end_time: "13:00" }),
    "09:00 – 13:00",
  );
  assert.equal(
    hoursLine({ is_available: false, start_time: "09:00", end_time: "13:00" }),
    "Unavailable",
  );
});
