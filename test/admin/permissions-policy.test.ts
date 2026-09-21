import assert from "node:assert/strict";
import test from "node:test";

import { permissionsPolicy } from "@/lib/admin/security/csp";

test("admin denies camera and microphone so the browser never prompts", () => {
  const policy = permissionsPolicy("admin");
  assert.match(policy, /camera=\(\)/);
  assert.match(policy, /microphone=\(\)/);
  assert.match(policy, /display-capture=\(\)/);
});

test("patient and doctor allow camera and microphone from this origin", () => {
  for (const surface of ["patient", "doctor"]) {
    const policy = permissionsPolicy(surface);
    assert.match(policy, /camera=\(self\)/, surface);
    assert.match(policy, /microphone=\(self\)/, surface);
    assert.match(policy, /display-capture=\(self\)/, surface);
    assert.doesNotMatch(policy, /camera=\(\)/);
  }
});
