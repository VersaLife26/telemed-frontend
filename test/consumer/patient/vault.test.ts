import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_UPLOAD_BYTES,
  VAULT_TYPES,
  formatBytes,
  recordsListPath,
  uploadError,
} from "@/lib/consumer/features/vault";

test("vault types are the three document kinds the UI offers", () => {
  assert.deepEqual(
    VAULT_TYPES.map((t) => t.value),
    ["report", "scan", "prescription"],
  );
});

test("uploads larger than 10 MB are refused", () => {
  assert.equal(MAX_UPLOAD_BYTES, 10 * 1024 * 1024);
  assert.equal(uploadError(MAX_UPLOAD_BYTES), null);
  assert.equal(uploadError(MAX_UPLOAD_BYTES + 1), "File must be 10 MB or smaller.");
});

test("formatBytes stays empty for missing sizes", () => {
  assert.equal(formatBytes(undefined), "");
  assert.equal(formatBytes(0), "");
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(2048), "2 KB");
  assert.equal(formatBytes(2 * 1024 * 1024), "2.0 MB");
});

test("recordsListPath filters by document_type when set", () => {
  assert.equal(recordsListPath(""), "/records");
  assert.equal(recordsListPath("scan"), "/records?document_type=scan");
});
