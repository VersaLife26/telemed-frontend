import assert from "node:assert/strict";
import test from "node:test";

import type { Appointment } from "@/lib/consumer/api/types";
import {
  colomboDayKey,
  colomboMinutes,
  dayOfWeek,
  eventsByDay,
  gridWindow,
  isDayKey,
  minuteLabel,
  placeEvents,
  shiftWeek,
  toCalendarEvent,
  upcomingDayKeys,
  weekDayKeys,
  weekRangeLabel,
  weekStart,
  workingBands,
  type CalendarEvent,
} from "@/lib/consumer/features/calendar";

function appt(overrides: Partial<Appointment>): Appointment {
  return {
    id: "a1",
    patientId: "p1",
    doctorId: "d1",
    startAt: "2026-09-21T03:30:00Z",
    endAt: "2026-09-21T04:00:00Z",
    status: "confirmed",
    feeCents: 250000,
    currency: "LKR",
    visitPatient: { name: "Kamala", dateOfBirth: "1990-01-01", sex: null, weightKg: null, allergies: null },
    intake: { symptoms: "fever", visitRelation: null },
    paymentDueAt: null,
    confirmedAt: null,
    completedAt: null,
    noShowAt: null,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    refundPercent: null,
    isTest: false,
    createdAt: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

function event(id: string, startMinute: number, endMinute: number): CalendarEvent {
  return {
    id,
    title: id,
    startMinute,
    endMinute,
    startLabel: minuteLabel(startMinute),
    endLabel: minuteLabel(endMinute),
  };
}

test("the week starts on Monday, and Sunday belongs to the week before it", () => {
  // 2026-09-21 is a Monday; 2026-09-20 is the Sunday that closes the week
  // before, which is the case a `getDay() - 1` would get wrong.
  assert.equal(weekStart("2026-09-21"), "2026-09-21");
  assert.equal(weekStart("2026-09-26"), "2026-09-21");
  assert.equal(weekStart("2026-09-20"), "2026-09-14");
});

test("shiftWeek moves whole weeks in both directions", () => {
  assert.equal(shiftWeek("2026-09-21", 1), "2026-09-28");
  assert.equal(shiftWeek("2026-09-21", -1), "2026-09-14");
  assert.equal(shiftWeek("2026-09-21", 0), "2026-09-21");
});

test("upcomingDayKeys is today and the following civil days", () => {
  assert.deepEqual(upcomingDayKeys(3, new Date("2026-09-19T12:30:00Z")), [
    "2026-09-19",
    "2026-09-20",
    "2026-09-21",
  ]);
});

test("weekDayKeys is seven consecutive days, Monday first", () => {
  assert.deepEqual(weekDayKeys("2026-09-21"), [
    "2026-09-21",
    "2026-09-22",
    "2026-09-23",
    "2026-09-24",
    "2026-09-25",
    "2026-09-26",
    "2026-09-27",
  ]);
});

test("a UTC instant is bucketed by its Colombo day, not the server's", () => {
  // 19:00 UTC is already the next morning in Colombo (+05:30). Bucketing on
  // the raw date would file this visit under the wrong day of the grid.
  assert.equal(colomboDayKey("2026-09-20T19:00:00Z"), "2026-09-21");
  assert.equal(colomboMinutes("2026-09-20T19:00:00Z"), 30);
  assert.equal(colomboDayKey("2026-09-21T03:30:00Z"), "2026-09-21");
  assert.equal(colomboMinutes("2026-09-21T03:30:00Z"), 9 * 60);
});

test("isDayKey refuses a malformed or impossible date", () => {
  assert.equal(isDayKey("2026-09-21"), true);
  assert.equal(isDayKey("2026-02-30"), false);
  assert.equal(isDayKey("2026-9-1"), false);
  assert.equal(isDayKey(undefined), false);
});

test("an event spans the booked start and end, titled with the visit patient", () => {
  const placed = toCalendarEvent(appt({ endAt: "2026-09-21T04:15:00Z" }));
  assert.ok(placed);
  assert.equal(placed.dayKey, "2026-09-21");
  assert.equal(placed.event.startMinute, 540);
  assert.equal(placed.event.endMinute, 585);
  assert.equal(placed.event.title, "Kamala");
});

test("an end at or before the start is treated as missing", () => {
  const placed = toCalendarEvent(appt({ endAt: "2026-09-21T03:30:00Z" }));
  assert.equal(placed?.event.endMinute, 570);
});

test("cancelled and no-show visits are off the schedule and never drawn", () => {
  for (const status of ["cancelled", "noShow"] as const) {
    assert.equal(toCalendarEvent(appt({ status })), null, status);
  }
  assert.ok(toCalendarEvent(appt({ status: "confirmed" })));
  assert.ok(toCalendarEvent(appt({ status: "pendingPayment" })));
});

test("an appointment with no start cannot be positioned", () => {
  assert.equal(toCalendarEvent(appt({ startAt: "" })), null);
});

test("overlapping events split the column, and neighbours keep full width", () => {
  const placed = placeEvents([event("a", 540, 600), event("b", 570, 630), event("c", 700, 760)]);
  const byId = Object.fromEntries(placed.map((p) => [p.id, p]));

  assert.equal(byId.a?.lanes, 2);
  assert.equal(byId.b?.lanes, 2);
  assert.notEqual(byId.a?.lane, byId.b?.lane);
  // `c` starts after the a/b cluster ends, so it is its own cluster and must
  // not be squeezed to half width by an overlap it is not part of.
  assert.equal(byId.c?.lanes, 1);
  assert.equal(byId.c?.lane, 0);
});

test("a lane is reused once the event occupying it has ended", () => {
  const placed = placeEvents([event("a", 540, 600), event("b", 570, 660), event("c", 600, 640)]);
  const byId = Object.fromEntries(placed.map((p) => [p.id, p]));
  assert.equal(byId.a?.lane, 0);
  assert.equal(byId.b?.lane, 1);
  assert.equal(byId.c?.lane, 0);
  assert.equal(byId.c?.lanes, 2);
});

test("eventsByDay returns a bucket for every day, including empty ones", () => {
  const days = weekDayKeys("2026-09-21");
  const byDay = eventsByDay(
    [
      appt({ id: "a1", startAt: "2026-09-21T03:30:00Z", endAt: "2026-09-21T04:00:00Z" }),
      appt({ id: "a2", startAt: "2026-09-23T05:00:00Z", endAt: "2026-09-23T05:30:00Z", status: "completed" }),
      appt({ id: "a3", startAt: "2026-09-23T05:00:00Z", endAt: "2026-09-23T05:30:00Z", status: "cancelled" }),
    ],
    days,
  );

  assert.equal(Object.keys(byDay).length, 7);
  assert.equal(byDay["2026-09-21"]?.length, 1);
  assert.equal(byDay["2026-09-23"]?.length, 1);
  assert.equal(byDay["2026-09-22"]?.length, 0);
});

test("an appointment outside the requested week is dropped, not misfiled", () => {
  const byDay = eventsByDay(
    [appt({ startAt: "2026-10-05T03:30:00Z", endAt: "2026-10-05T04:00:00Z" })],
    weekDayKeys("2026-09-21"),
  );
  assert.deepEqual(
    Object.values(byDay).flat(),
    [],
  );
});

test("the grid widens to cover every event and every working hour", () => {
  const window = gridWindow(
    placeEvents([event("early", 6 * 60 + 15, 7 * 60)]),
    [{ dayOfWeek: 1, startMinute: 540, endMinute: 1230 }],
  );
  assert.equal(window.startMinute, 6 * 60);
  assert.equal(window.endMinute, 21 * 60);
  assert.equal(window.hours[0], 6 * 60);
  assert.equal(window.hours.at(-1), 21 * 60);
});

test("with no events or working hours the grid shows the default day", () => {
  const window = gridWindow([], []);
  assert.equal(window.startMinute, 8 * 60);
  assert.equal(window.endMinute, 18 * 60);
});

test("workingBands keeps only the non-empty ranges for that weekday", () => {
  const hours = [
    { dayOfWeek: 1, startMinute: 540, endMinute: 720 },
    { dayOfWeek: 1, startMinute: 780, endMinute: 1020 },
    { dayOfWeek: 1, startMinute: 1080, endMinute: 1080 },
    { dayOfWeek: 2, startMinute: 540, endMinute: 1020 },
  ];
  assert.deepEqual(workingBands(hours, 1), [
    { startMinute: 540, endMinute: 720 },
    { startMinute: 780, endMinute: 1020 },
  ]);
});

test("dayOfWeek matches the Sunday-zero convention the schedule API uses", () => {
  assert.equal(dayOfWeek("2026-09-20"), 0);
  assert.equal(dayOfWeek("2026-09-21"), 1);
  assert.equal(dayOfWeek("2026-09-26"), 6);
});

test("minute labels use a 12-hour clock", () => {
  assert.equal(minuteLabel(540), "9:00 AM");
  assert.equal(minuteLabel(825), "1:45 PM");
  assert.equal(minuteLabel(0), "12:00 AM");
  assert.equal(minuteLabel(720), "12:00 PM");
});

test("the range label collapses a month the week does not cross", () => {
  assert.equal(weekRangeLabel("2026-09-21"), "21 – 27 September 2026");
  assert.equal(weekRangeLabel("2026-09-28"), "28 September – 4 October 2026");
});
