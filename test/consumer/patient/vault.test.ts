import assert from "node:assert/strict";
import test from "node:test";

import type { VaultFolder } from "@/lib/consumer/api/types";
import {
  childFolders,
  documentDownloadPath,
  documentsListPath,
  folderCrumbs,
  foldersListPath,
  previewKind,
  proxiedFileUrl,
} from "@/lib/consumer/features/vault";

function folder(id: string, name: string, parentId: string | null): VaultFolder {
  return { id, ownerId: "u", parentId, name, createdAt: "", updatedAt: "" };
}

const folders = [folder("a", "Labs", null), folder("b", "2026", "a"), folder("c", "Scans", null)];

test("previewKind maps content types", () => {
  assert.equal(previewKind("application/pdf"), "pdf");
  assert.equal(previewKind("image/png"), "image");
  assert.equal(previewKind("video/mp4"), "video");
  assert.equal(previewKind("audio/mpeg"), "audio");
  assert.equal(previewKind("application/octet-stream"), "other");
  assert.equal(previewKind(), "other");
});

test("folderCrumbs walks parentId up to the vault root", () => {
  assert.deepEqual(folderCrumbs(folders, null), [{ id: null, name: "Vault" }]);
  assert.deepEqual(folderCrumbs(folders, "b"), [
    { id: null, name: "Vault" },
    { id: "a", name: "Labs" },
    { id: "b", name: "2026" },
  ]);
  assert.deepEqual(folderCrumbs(folders, "missing"), [{ id: null, name: "Vault" }]);
});

test("childFolders picks one level of the flat list", () => {
  assert.deepEqual(childFolders(folders, null).map((f) => f.id), ["a", "c"]);
  assert.deepEqual(childFolders(folders, "a").map((f) => f.id), ["b"]);
});

test("documentsListPath scopes a folder (root by default), a type and a patient", () => {
  assert.equal(documentsListPath(), "/vault/documents?folderId=root&pageSize=100");
  assert.equal(
    documentsListPath("scan", "f1", "user-1"),
    "/vault/documents?folderId=f1&pageSize=100&documentType=scan&patientId=user-1",
  );
  assert.equal(foldersListPath(), "/vault/folders");
  assert.equal(foldersListPath("user-1"), "/vault/folders?patientId=user-1");
  assert.equal(documentDownloadPath("doc-1"), "/vault/documents/doc-1/download");
});

test("proxiedFileUrl sends signed file links through the BFF", () => {
  assert.equal(proxiedFileUrl("/api/v1/files/abc.def"), "/api/proxy/files/abc.def");
});
