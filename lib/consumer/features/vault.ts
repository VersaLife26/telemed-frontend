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

export function recordsListPath(documentType: string): string {
  return documentType ? `/records?document_type=${encodeURIComponent(documentType)}` : "/records";
}
