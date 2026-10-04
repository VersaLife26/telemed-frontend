import assert from "node:assert/strict";
import test from "node:test";

import {
  DOCTOR_GUIDE,
  PATIENT_GUIDE,
  clearGuideSeen,
  readGuideSeen,
  resolveGuideSteps,
  shouldAutoStartGuide,
  writeGuideSeen,
} from "@/lib/consumer/features/guide-tour";

test("a first visit on a main page starts the guide, and a deep link does not", () => {
  assert.equal(shouldAutoStartGuide("patient", "/home", false), true);
  assert.equal(shouldAutoStartGuide("patient", "/doctors", false), true);
  assert.equal(shouldAutoStartGuide("patient", "/home", true), false);
  assert.equal(shouldAutoStartGuide("patient", "/doctors/doc-1", false), false);
  assert.equal(shouldAutoStartGuide("patient", "/appointments/apt-1/payment", false), false);

  assert.equal(shouldAutoStartGuide("doctor", "/dashboard", false), true);
  assert.equal(shouldAutoStartGuide("doctor", "/verification-pending", false), true);
  assert.equal(shouldAutoStartGuide("doctor", "/appointments/apt-1/visit", false), false);
  assert.equal(shouldAutoStartGuide("doctor", "/workspace", false), false);
});

test("phone steps that are behind More collapse into one step", () => {
  const onPhone = new Set(["dashboard", "appointments", "calendar", "queue", "profile", "care", "more"]);
  const steps = resolveGuideSteps(DOCTOR_GUIDE, (id) => onPhone.has(id));

  assert.deepEqual(
    steps.map((step) => step.target),
    ["dashboard", "more", "appointments", "calendar", "queue", "profile", "care"],
  );
  const more = steps[1];
  assert.ok(more);
  assert.match(more.body, /Workspace/);
  assert.match(more.body, /Availability/);
  assert.match(more.body, /Earnings/);
});

test("a wide screen keeps every doctor step", () => {
  const steps = resolveGuideSteps(DOCTOR_GUIDE, () => true);
  assert.deepEqual(
    steps.map((step) => step.id),
    DOCTOR_GUIDE.map((step) => step.id),
  );
});

test("patient steps stay in nav order when every target is on screen", () => {
  const steps = resolveGuideSteps(PATIENT_GUIDE, () => true);
  assert.deepEqual(
    steps.map((step) => step.target),
    ["home", "doctors", "appointments", "vault", "profile", "care"],
  );
});

test("seeing the guide is remembered per surface until it is cleared", () => {
  const saved = new Map<string, string>();
  const storage = {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => {
      saved.set(key, value);
    },
    removeItem: (key: string) => {
      saved.delete(key);
    },
  };

  assert.equal(readGuideSeen(storage, "patient"), false);
  writeGuideSeen(storage, "patient");
  assert.equal(readGuideSeen(storage, "patient"), true);
  assert.equal(readGuideSeen(storage, "doctor"), false);
  clearGuideSeen(storage, "patient");
  assert.equal(readGuideSeen(storage, "patient"), false);
});
