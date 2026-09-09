import assert from "node:assert/strict";
import test from "node:test";

import { formatMoney, formatWait, paymentSettled } from "@/lib/consumer/money";

test("formatMoney renders a dash when cents are missing", () => {
  assert.equal(formatMoney(null), "—");
  assert.equal(formatMoney(undefined), "—");
});

test("formatMoney prefixes the currency and converts cents", () => {
  const rendered = formatMoney(100, "LKR");
  assert.match(rendered, /^LKR /);
  assert.match(rendered, /1\.00$/);
});

test("formatWait rounds seconds to minutes and floors empty waits", () => {
  assert.equal(formatWait(null), "a few minutes");
  assert.equal(formatWait(0), "a few minutes");
  assert.equal(formatWait(30), "about 1 min");
  assert.equal(formatWait(180), "about 3 min");
});

test("paymentSettled is true on succeeded or next_action none", () => {
  assert.equal(paymentSettled("succeeded"), true);
  assert.equal(paymentSettled("requires_action", "none"), true);
  assert.equal(paymentSettled("requires_action", "redirect"), false);
  assert.equal(paymentSettled("pending"), false);
});
