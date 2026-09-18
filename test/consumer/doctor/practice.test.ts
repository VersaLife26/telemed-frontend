import assert from "node:assert/strict";
import test from "node:test";

import type { Doctor } from "@/lib/consumer/api/types";
import {
  availabilityPutBody,
  busiestLabel,
  consultLanguages,
  defaultWorkingHours,
  documentMetadataBody,
  doctorFeeCents,
  fillWorkingHours,
  formatRate,
  peakGrid,
  practiceProfileBody,
  rupeesToCents,
  summarizePracticeEarnings,
} from "@/lib/consumer/features/practice";

test("formatRate prints fractions as percents", () => {
  assert.equal(formatRate(0.097), "9.7%");
  assert.equal(formatRate(0), "0.0%");
  assert.equal(formatRate(undefined), "—");
});

test("peakGrid fills a sparse week and busiestLabel names the cell", () => {
  const grid = peakGrid([
    { day_of_week: 1, hour_of_day: 9, bookings: 4 },
    { day_of_week: 1, hour_of_day: 10, bookings: 1 },
  ]);
  assert.equal(grid[1][9], 4);
  assert.equal(grid[0][0], 0);
  assert.equal(
    busiestLabel({ day_of_week: 1, hour_of_day: 9, bookings: 4 }),
    "Mon 09:00 · 4 bookings",
  );
  assert.equal(busiestLabel(null), "No bookings yet");
});

test("fillWorkingHours keeps stored days and fills the rest", () => {
  const filled = fillWorkingHours([
    { day_of_week: 1, start_time: "08:00", end_time: "12:00", is_available: true },
  ]);
  assert.equal(filled.length, 7);
  assert.equal(filled[1].start_time, "08:00");
  assert.equal(filled[0].is_available, false);
});

test("availabilityPutBody omits unset buffer and empty holidays", () => {
  const body = availabilityPutBody({
    hours: defaultWorkingHours().slice(0, 1),
    slotMinutes: 20,
    buffer: "",
    maxPerDay: 8,
    holidays: [],
  });
  assert.equal(body.slot_duration_minutes, 20);
  assert.equal(body.max_per_day, 8);
  assert.equal("buffer_minutes" in body, false);
  assert.equal("holidays" in body, false);
});

test("availabilityPutBody sends 0 buffer and additive leave dates", () => {
  const body = availabilityPutBody({
    hours: [
      { day_of_week: 2, start_time: "09:00:00", end_time: "17:00:00", is_available: true },
    ],
    slotMinutes: 30,
    buffer: "0",
    maxPerDay: 0,
    holidays: [{ date: "2026-12-25", reason: "Christmas" }],
  });
  assert.equal(body.buffer_minutes, 0);
  assert.deepEqual(body.working_hours, [
    { day_of_week: 2, start_time: "09:00", end_time: "17:00", is_available: true },
  ]);
  assert.deepEqual(body.holidays, [{ date: "2026-12-25", reason: "Christmas" }]);
});

test("practiceProfileBody uses fee_lkr cents and round-trips qualifications", () => {
  const doctor: Doctor = {
    id: "d1",
    specialty: "Cardiology",
    version: 4,
    fee_cents: 250000,
    bio: "old",
    qualifications: [{ degree: "MBBS", institution: "Colombo", year: 2012 }],
    sub_specialties: ["Interventional"],
    accepts_new_patients: false,
    photo_url: "https://cdn.example/photo.jpg",
  };
  assert.equal(doctorFeeCents(doctor), 250000);
  assert.equal(rupeesToCents(2500), 250000);
  assert.deepEqual(
    practiceProfileBody(doctor, {
      bio: "Heart clinic",
      feeRupees: 3000,
      languages: ["en", "si"],
      experienceYears: 12,
    }),
    {
      version: 4,
      specialty: "Cardiology",
      experience_years: 12,
      fee_lkr: 300000,
      languages: ["en", "si"],
      bio: "Heart clinic",
      accepts_new_patients: false,
      sub_specialties: ["Interventional"],
      qualifications: [{ degree: "MBBS", institution: "Colombo", year: 2012 }],
      photo_url: "https://cdn.example/photo.jpg",
    },
  );
});

test("consultLanguages keeps only en/si/ta/other", () => {
  assert.deepEqual(consultLanguages(["en", "English", "si"]), ["en", "si"]);
  assert.deepEqual(consultLanguages([]), ["en"]);
});

test("documentMetadataBody is type plus filename, never bytes", () => {
  assert.deepEqual(documentMetadataBody("slmc_certificate", "  slmc.pdf  "), {
    document_type: "slmc_certificate",
    filename: "slmc.pdf",
  });
});

test("summarizePracticeEarnings maps net/paid/unpaid", () => {
  assert.deepEqual(
    summarizePracticeEarnings({
      currency: "LKR",
      net_cents: 80000,
      paid_cents: 50000,
      unpaid_cents: 30000,
      commission_cents: 10000,
      gross_cents: 90000,
      payout_status: "partially_paid",
    }),
    {
      currency: "LKR",
      earned: 80000,
      paid: 50000,
      pending: 30000,
      commission: 10000,
      gross: 90000,
      status: "Partially paid",
    },
  );
});
