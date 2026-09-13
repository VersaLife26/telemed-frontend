import assert from "node:assert/strict";
import test from "node:test";

import { verifyDecisionBody } from "@/lib/admin/api/adapters/credentialing";

test("verify POST body is only action and reason", () => {
  // admin-service DecodeJSON uses DisallowUnknownFields. Sending `version`
  // (the checklist optimistic-lock field) 400'd Confirm approval, and the
  // error toast sat behind the dialog.
  assert.deepEqual(verifyDecisionBody("approve", "  SLMC confirmed on the register.  "), {
    action: "approve",
    reason: "SLMC confirmed on the register.",
  });
  assert.deepEqual(Object.keys(verifyDecisionBody("reject", "certificate image is altered")), [
    "action",
    "reason",
  ]);
});
