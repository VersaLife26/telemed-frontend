import assert from "node:assert/strict";
import test from "node:test";

import type { Specialty } from "@/lib/consumer/api/types";
import {
  buildDoctorsApiQuery,
  hasActiveDoctorFilters,
  specialtyLabel,
} from "@/lib/consumer/features/doctor-search";

test("buildDoctorsApiQuery always sets paging and sort defaults", () => {
  const qs = new URLSearchParams(buildDoctorsApiQuery({}));
  assert.equal(qs.get("pageSize"), "30");
  assert.equal(qs.get("sort"), "experience");
  assert.equal(qs.get("q"), null);
  assert.equal(qs.get("specialty"), null);
  assert.equal(qs.get("minFee"), null);
  assert.equal(qs.get("maxFee"), null);
  assert.equal(new URLSearchParams(buildDoctorsApiQuery({}, 6)).get("pageSize"), "6");
});

test("buildDoctorsApiQuery maps LKR fee filters to cents", () => {
  const qs = new URLSearchParams(
    buildDoctorsApiQuery({
      q: "kasun",
      specialty: "cardiology",
      minFee: "3000",
      maxFee: "5000.50",
    }),
  );
  assert.equal(qs.get("q"), "kasun");
  assert.equal(qs.get("specialty"), "cardiology");
  assert.equal(qs.get("minFee"), "300000");
  assert.equal(qs.get("maxFee"), "500050");
});

test("buildDoctorsApiQuery ignores invalid fee strings", () => {
  const qs = new URLSearchParams(buildDoctorsApiQuery({ minFee: "abc", maxFee: "-1" }));
  assert.equal(qs.get("minFee"), null);
  assert.equal(qs.get("maxFee"), null);
});

test("specialtyLabel uses the name from GET /specialties", () => {
  const specialties: Specialty[] = [
    { code: "cardiology", nameEn: "Cardiology", nameSi: "", nameTa: "", displayOrder: 1 },
  ];
  assert.equal(specialtyLabel("cardiology", specialties), "Cardiology");
  assert.equal(specialtyLabel("unknown_thing", specialties), "unknown thing");
  assert.equal(specialtyLabel("cardiology"), "cardiology");
  assert.equal(specialtyLabel(null), "—");
});

test("hasActiveDoctorFilters detects any non-empty filter", () => {
  assert.equal(hasActiveDoctorFilters({}), false);
  assert.equal(hasActiveDoctorFilters({ q: "  " }), false);
  assert.equal(hasActiveDoctorFilters({ specialty: "dermatology" }), true);
  assert.equal(hasActiveDoctorFilters({ minFee: "1000" }), true);
});
