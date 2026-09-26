import assert from "node:assert/strict";
import test from "node:test";

import type { DoctorProfile, Schedule } from "@/lib/consumer/api/types";
import {
  apiFileSrc,
  busiestCell,
  busiestLabel,
  cancellationRate,
  consultLanguages,
  credentialDocumentError,
  doctorFeeCents,
  flattenWorkingHours,
  formatRate,
  groupWorkingHours,
  peakGrid,
  practiceProfileBody,
  rupeesToCents,
  schedulePutBody,
} from "@/lib/consumer/features/practice";

test("formatRate prints fractions as percents", () => {
  assert.equal(formatRate(0.097), "9.7%");
  assert.equal(formatRate(0), "0.0%");
  assert.equal(formatRate(undefined), "—");
});

test("cancellationRate divides cancelled by consultations", () => {
  assert.equal(cancellationRate({ consultations: 10, cancelled: 2 }), 0.2);
  assert.equal(cancellationRate({ consultations: 0, cancelled: 0 }), 0);
  assert.equal(cancellationRate(null), null);
});

test("peakGrid fills a sparse week and busiestLabel names the busiest cell", () => {
  const cells = [
    { dayOfWeek: 1, hour: 9, count: 4 },
    { dayOfWeek: 1, hour: 10, count: 1 },
  ];
  const grid = peakGrid(cells);
  assert.equal(grid[1]?.[9], 4);
  assert.equal(grid[0]?.[0], 0);
  assert.deepEqual(busiestCell(cells), { dayOfWeek: 1, hour: 9, count: 4 });
  assert.equal(busiestLabel(busiestCell(cells)), "Mon 09:00 · 4 bookings");
  assert.equal(busiestLabel(busiestCell([])), "No bookings yet");
});

test("groupWorkingHours: rows mean a working day, no rows mean a day off", () => {
  const { windows, available } = groupWorkingHours([
    { dayOfWeek: 1, startMinute: 960, endMinute: 1200 },
    { dayOfWeek: 1, startMinute: 480, endMinute: 720 },
  ]);
  assert.equal(available[1], true);
  assert.equal(available[0], false);
  assert.deepEqual(windows[1], [
    { start: "08:00", end: "12:00" },
    { start: "16:00", end: "20:00" },
  ]);
  assert.deepEqual(windows[0], [{ start: "09:00", end: "17:00" }]);
});

test("flattenWorkingHours sends minutes for working days only", () => {
  const { windows, available } = groupWorkingHours([
    { dayOfWeek: 1, startMinute: 480, endMinute: 720 },
    { dayOfWeek: 1, startMinute: 960, endMinute: 1200 },
  ]);
  assert.deepEqual(flattenWorkingHours(windows, available), [
    { dayOfWeek: 1, startMinute: 480, endMinute: 720 },
    { dayOfWeek: 1, startMinute: 960, endMinute: 1200 },
  ]);
  assert.deepEqual(flattenWorkingHours(windows, { ...available, 1: false }), []);
});

test("schedulePutBody keeps advance days and time zone from the stored schedule", () => {
  const current: Schedule = {
    slotDurationMinutes: 30,
    bufferMinutes: 5,
    maxPerDay: 10,
    advanceDays: 14,
    timezone: "Asia/Colombo",
    workingHours: [],
  };
  assert.deepEqual(
    schedulePutBody(current, {
      hours: [{ dayOfWeek: 2, startMinute: 540, endMinute: 1020 }],
      slotMinutes: 20,
      bufferMinutes: 0,
      maxPerDay: 8,
    }),
    {
      slotDurationMinutes: 20,
      bufferMinutes: 0,
      maxPerDay: 8,
      advanceDays: 14,
      timezone: "Asia/Colombo",
      workingHours: [{ dayOfWeek: 2, startMinute: 540, endMinute: 1020 }],
    },
  );
});

test("practiceProfileBody sends feeCents and round-trips the profile", () => {
  const doctor: DoctorProfile = {
    id: "d1",
    displayName: "Dr Silva",
    specialtyCode: "cardiology",
    version: 4,
    feeCents: 250000,
    bio: "old",
    languages: ["en"],
    qualifications: [{ degree: "MBBS", institution: "Colombo", year: 2012 }],
    subSpecialties: ["Interventional"],
    acceptsNewPatients: false,
  };
  assert.equal(doctorFeeCents(doctor), 250000);
  assert.equal(rupeesToCents(2500), 250000);
  assert.deepEqual(
    practiceProfileBody(doctor, {
      bio: " Heart clinic ",
      feeRupees: 3000,
      languages: ["en", "si"],
      experienceYears: 12,
    }),
    {
      displayName: "Dr Silva",
      bio: "Heart clinic",
      subSpecialties: ["Interventional"],
      languages: ["en", "si"],
      languageOther: null,
      qualifications: [{ degree: "MBBS", institution: "Colombo", year: 2012 }],
      experienceYears: 12,
      feeCents: 300000,
      acceptsNewPatients: false,
      version: 4,
    },
  );
});

test("consultLanguages keeps only en/si/ta/other", () => {
  assert.deepEqual(consultLanguages(["en", "English", "si"]), ["en", "si"]);
  assert.deepEqual(consultLanguages([]), ["en"]);
});

test("credentialDocumentError accepts PDFs, JPEGs and PNGs up to 5 MB", () => {
  assert.equal(credentialDocumentError(null), "Choose a file to upload.");
  assert.equal(credentialDocumentError({ type: "application/pdf", size: 1024 }), null);
  assert.equal(credentialDocumentError({ type: "image/webp", size: 1024 }), "Upload a PDF, JPEG or PNG file.");
  assert.equal(
    credentialDocumentError({ type: "image/png", size: 6 * 1024 * 1024 }),
    "Each document must be 5 MB or smaller.",
  );
});

test("apiFileSrc routes signed API file links through the BFF", () => {
  assert.equal(apiFileSrc("/api/v1/files/abc.def"), "/api/proxy/files/abc.def");
  assert.equal(apiFileSrc("https://cdn.example/x.png"), "https://cdn.example/x.png");
  assert.equal(apiFileSrc(null), null);
});
