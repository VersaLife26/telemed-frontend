import assert from "node:assert/strict";
import test from "node:test";

import {
  folderCrumbs,
  isCapturedRecordId,
  previewKind,
  recordsListPath,
  recordDownloadPath,
} from "@/lib/consumer/features/vault";

test("previewKind maps content types", () => {
  assert.equal(previewKind("application/pdf"), "pdf");
  assert.equal(previewKind("image/png"), "image");
  assert.equal(previewKind("video/mp4"), "video");
  assert.equal(previewKind("audio/mpeg"), "audio");
  assert.equal(previewKind("application/octet-stream"), "other");
  assert.equal(previewKind(), "other");
});

test("folderCrumbs always starts at the vault root", () => {
  assert.deepEqual(folderCrumbs([]), [{ id: null, name: "Vault" }]);
  assert.deepEqual(
    folderCrumbs([
      { id: "a", owner_user_id: "u", name: "Labs" },
      { id: "b", owner_user_id: "u", name: "2026" },
    ]),
    [
      { id: null, name: "Vault" },
      { id: "a", name: "Labs" },
      { id: "b", name: "2026" },
    ],
  );
});

test("recordsListPath scopes a folder and an owner", () => {
  assert.equal(recordsListPath(), "/records");
  assert.equal(recordsListPath("scan", null, "user-1"), "/records?document_type=scan&folder_id=root&owner_user_id=user-1");
  assert.equal(recordDownloadPath("doc-1", true), "/records/doc-1/download?disposition=attachment");
  assert.equal(recordDownloadPath("doc-1"), "/records/doc-1/download");
});

test("isCapturedRecordId is the old /records/{id} collision", () => {
  assert.equal(isCapturedRecordId(new Error("id must be a valid UUID")), true);
  assert.equal(isCapturedRecordId(new Error("folder_id must be a valid UUID")), false);
});
