import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDoctorsApiQuery,
  hasActiveDoctorFilters,
  specialtyLabel,
} from "@/lib/consumer/features/doctor-search";

test("buildDoctorsApiQuery always sets paging and sort defaults", () => {
  const qs = new URLSearchParams(buildDoctorsApiQuery({}));
  assert.equal(qs.get("per_page"), "30");
  assert.equal(qs.get("sort"), "rating");
  assert.equal(qs.get("q"), null);
  assert.equal(qs.get("specialty"), null);
  assert.equal(qs.get("min_fee"), null);
  assert.equal(qs.get("max_fee"), null);
});

test("buildDoctorsApiQuery maps LKR fee filters to cents", () => {
  const qs = new URLSearchParams(
    buildDoctorsApiQuery({
      q: "kasun",
      specialty: "cardiology",
      min_fee: "3000",
      max_fee: "5000.50",
    }),
  );
  assert.equal(qs.get("q"), "kasun");
  assert.equal(qs.get("specialty"), "cardiology");
  assert.equal(qs.get("min_fee"), "300000");
  assert.equal(qs.get("max_fee"), "500050");
});

test("buildDoctorsApiQuery ignores unknown specialty codes", () => {
  const qs = new URLSearchParams(buildDoctorsApiQuery({ specialty: "not_a_real_code" }));
  assert.equal(qs.get("specialty"), null);
});

test("buildDoctorsApiQuery ignores invalid fee strings", () => {
  const qs = new URLSearchParams(buildDoctorsApiQuery({ min_fee: "abc", max_fee: "-1" }));
  assert.equal(qs.get("min_fee"), null);
  assert.equal(qs.get("max_fee"), null);
});

test("specialtyLabel uses the known catalogue label", () => {
  assert.equal(specialtyLabel("cardiology"), "Cardiology");
  assert.equal(specialtyLabel("unknown_thing"), "unknown thing");
  assert.equal(specialtyLabel(null), "—");
});

test("hasActiveDoctorFilters detects any non-empty filter", () => {
  assert.equal(hasActiveDoctorFilters({}), false);
  assert.equal(hasActiveDoctorFilters({ q: "  " }), false);
  assert.equal(hasActiveDoctorFilters({ specialty: "dermatology" }), true);
  assert.equal(hasActiveDoctorFilters({ min_fee: "1000" }), true);
});
