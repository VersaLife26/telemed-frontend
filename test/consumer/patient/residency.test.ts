import assert from "node:assert/strict";
import test from "node:test";

import { countryHeaders } from "@/lib/consumer/auth/country";
import { quotedFee } from "@/lib/consumer/money";
import { isCitizenshipRequired, residencyError, residencyFields } from "@/lib/consumer/features/residency";
import { verifyOtpBody } from "@/lib/consumer/features/otp";

test("patient app forwards a two-letter country and drops anything else", () => {
  assert.deepEqual(
    countryHeaders(new Request("https://patient.example", { headers: { "CF-IPCountry": "lk" } })),
    { "CF-IPCountry": "LK" },
  );
  assert.deepEqual(
    countryHeaders(new Request("https://patient.example", { headers: { "CF-IPCountry": "T1" } })),
    {},
  );
  assert.deepEqual(countryHeaders(new Request("https://patient.example")), {});
});

test("citizenship is required only when the question is asked", () => {
  assert.equal(residencyError(false, null, ""), null);
  assert.equal(residencyError(true, null, ""), "Say whether you are a Sri Lankan citizen.");
  assert.equal(residencyError(true, true, "  "), "Enter your National ID.");
  assert.equal(residencyError(true, false, ""), null);
});

test("sign-in asks for citizenship only when the account is new", () => {
  assert.equal(isCitizenshipRequired({ code: "citizenship_required", detail: "Say whether you are a Sri Lankan citizen." }), true);
  assert.equal(isCitizenshipRequired({ code: "invalid_otp" }), false);
  assert.equal(isCitizenshipRequired(null), false);
});

test("a non-citizen does not send a national id", () => {
  assert.deepEqual(residencyFields(false, "123456789V"), { isSriLankanCitizen: false });
  assert.deepEqual(residencyFields(true, " 123456789V "), {
    isSriLankanCitizen: true,
    nationalId: "123456789V",
  });
  assert.deepEqual(verifyOtpBody("+94", "123456", residencyFields(true, "123456789V")), {
    phone: "+94",
    code: "123456",
    isSriLankanCitizen: true,
    nationalId: "123456789V",
  });
});

test("a signed-in non-citizen sees the dollar quote", () => {
  const doctor = { feeCents: 250000, currency: "LKR", foreignFeeCents: 3333, foreignCurrency: "USD" };
  assert.deepEqual(quotedFee(doctor, false), { cents: 250000, currency: "LKR", available: true });
  assert.deepEqual(quotedFee(doctor, true), { cents: 3333, currency: "USD", available: true });
  assert.deepEqual(quotedFee({ feeCents: 250000, currency: "LKR" }, true), {
    cents: null,
    currency: "USD",
    available: false,
  });
});
