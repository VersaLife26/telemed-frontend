import type { VaultFolder, VaultPatient } from "@/lib/consumer/api/types";

export const VAULT_TYPES = [
  { value: "report", label: "Report" },
  { value: "scan", label: "Scan" },
  { value: "prescription", label: "Prescription" },
  { value: "other", label: "Other" },
] as const;

export type VaultDocType = (typeof VAULT_TYPES)[number]["value"];

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** The vault accepts PDFs and images only. */
export const UPLOAD_ACCEPT = "application/pdf,image/png,image/jpeg,image/webp";

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

/** `null` is the vault root, which the API names `root`. */
export function documentsListPath(
  documentType = "",
  folderId: string | null = null,
  patientId?: string,
): string {
  const q = new URLSearchParams({ folderId: folderId ?? "root", pageSize: "100" });
  if (documentType) q.set("documentType", documentType);
  if (patientId) q.set("patientId", patientId);
  return `/vault/documents?${q}`;
}

export function foldersListPath(patientId?: string): string {
  return patientId ? `/vault/folders?${new URLSearchParams({ patientId })}` : "/vault/folders";
}

export function patientsListPath(): string {
  return "/vault/patients";
}

export function documentDownloadPath(id: string): string {
  return `/vault/documents/${id}/download`;
}

/** Signed `/api/v1/files/…` links are fetched through the same-origin BFF proxy. */
export function proxiedFileUrl(signedUrl: string): string {
  return `/api/proxy/${signedUrl.replace(/^\/?(api\/v1\/)?/, "")}`;
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

export function childFolders(folders: VaultFolder[], parentId: string | null): VaultFolder[] {
  return folders.filter((folder) => (folder.parentId ?? null) === parentId);
}

export type FolderCrumb = { id: string | null; name: string };

/** Breadcrumb trail for the current folder, built from the flat folder list, always starting at the vault root. */
export function folderCrumbs(folders: VaultFolder[], folderId: string | null): FolderCrumb[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const trail: FolderCrumb[] = [];
  const seen = new Set<string>();
  let current = folderId ? byId.get(folderId) : undefined;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    trail.unshift({ id: current.id, name: current.name });
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return [{ id: null, name: "Vault" }, ...trail];
}

/**
 * During a call the workspace pins one patient and hides the rest. When the
 * doctor is free, every treated patient is listed.
 */
export function scopedPatients(patients: VaultPatient[], lockedRoot?: string | null): VaultPatient[] {
  if (!lockedRoot) return patients;
  return patients.filter((patient) => patient.patientId === lockedRoot);
}
