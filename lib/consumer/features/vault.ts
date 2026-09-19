import type { VaultFolder, VaultPatient } from "@/lib/consumer/api/types";

export const VAULT_TYPES = [
  { value: "report", label: "Report" },
  { value: "scan", label: "Scan" },
  { value: "prescription", label: "Prescription" },
] as const;

export type VaultDocType = (typeof VAULT_TYPES)[number]["value"];

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function formatBytes(n?: number): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function uploadError(size: number): string | null {
  if (size > MAX_UPLOAD_BYTES) return "File must be 10 MB or smaller.";
  return null;
}

/** `null` is the vault root; omit folder_id to list every folder. */
export function recordsListPath(
  documentType = "",
  folderId?: string | null,
  ownerUserId?: string,
): string {
  const q = new URLSearchParams();
  if (documentType) q.set("document_type", documentType);
  if (folderId === null) q.set("folder_id", "root");
  else if (folderId) q.set("folder_id", folderId);
  if (ownerUserId) q.set("owner_user_id", ownerUserId);
  const qs = q.toString();
  return qs ? `/records?${qs}` : "/records";
}

export function recordsUploadPath(): string {
  return "/records/upload";
}

export function foldersListPath(ownerUserId?: string, parentId?: string | null): string {
  const q = new URLSearchParams();
  if (ownerUserId) q.set("owner_user_id", ownerUserId);
  if (parentId) q.set("parent_id", parentId);
  const qs = q.toString();
  return qs ? `/records/folders?${qs}` : "/records/folders";
}

export function patientsListPath(): string {
  return "/records/patients";
}

export function recordDownloadPath(id: string, attachment = false): string {
  return attachment ? `/records/${id}/download?disposition=attachment` : `/records/${id}/download`;
}

export type PreviewKind = "pdf" | "image" | "video" | "audio" | "other";

export function previewKind(contentType?: string): PreviewKind {
  const type = (contentType || "").toLowerCase();
  if (type === "application/pdf") return "pdf";
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  return "other";
}

export type FolderCrumb = { id: string | null; name: string };

/** Breadcrumb trail for the current folder, always starting at the vault root. */
export function folderCrumbs(path: VaultFolder[]): FolderCrumb[] {
  return [{ id: null, name: "Vault" }, ...path.map((folder) => ({ id: folder.id, name: folder.name }))];
}

/**
 * During a call the workspace pins one patient and hides the rest. When the
 * doctor is free, every treated patient is listed.
 */
export function scopedPatients(patients: VaultPatient[], lockedRoot?: string | null): VaultPatient[] {
  if (!lockedRoot) return patients;
  return patients.filter((patient) => patient.user_id === lockedRoot);
}
