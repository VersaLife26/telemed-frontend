"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileText, FolderClosed, Trash2, Upload } from "lucide-react";

import { Alert } from "@/components/consumer/ui/Alert";
import { Button } from "@/components/consumer/ui/Button";
import { Card } from "@/components/consumer/ui/Card";
import { EmptyState } from "@/components/consumer/ui/EmptyState";
import { Modal } from "@/components/consumer/ui/Modal";
import { Select } from "@/components/consumer/ui/Select";
import { LoadingRegion, Skeleton } from "@/components/consumer/ui/Skeleton";
import { browserApi } from "@/lib/consumer/api/client";
import type { VaultDocument, VaultDownload } from "@/lib/consumer/api/types";
import {
  VAULT_TYPES,
  formatBytes,
  recordsListPath,
  uploadError,
  type VaultDocType,
} from "@/lib/consumer/features/vault";
import { cx } from "@/lib/consumer/cx";

export function VaultClient() {
  const [docs, setDocs] = useState<VaultDocument[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [docType, setDocType] = useState<VaultDocType>("report");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<VaultDocument | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (type: string) => {
    const data = await browserApi<VaultDocument[]>(recordsListPath(type));
    setDocs(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await load(filter);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load vault");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filter, load]);

  async function upload(file: File) {
    const tooBig = uploadError(file.size);
    if (tooBig) {
      setError(tooBig);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("document_type", docType);
      await browserApi<VaultDocument>("/records/upload", { method: "POST", body: form });
      await load(filter);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function download(id: string) {
    setError(null);
    try {
      const link = await browserApi<VaultDownload>(`/records/${id}/download`);
      if (link.download_url) window.open(link.download_url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    }
  }

  async function remove(id: string) {
    setError(null);
    setDeleting(true);
    try {
      await browserApi(`/records/${id}`, { method: "DELETE" });
      setDocs((prev) => prev.filter((d) => d.id !== id));
      setPendingDelete(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-h2 text-ink">Health vault</h1>
        <p className="mt-1 text-body-lg text-muted">
          Upload reports and scans. Downloads use a short-lived link.
        </p>
      </header>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Card variant="glass" className="flex flex-col gap-4 md:flex-row md:items-end">
        <Select
          id="vault-type"
          label="Document type"
          className="md:min-w-56"
          fieldClassName="md:flex-1"
          value={docType}
          onChange={(e) => setDocType(e.target.value as typeof docType)}
        >
          {VAULT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>

        {/* A label wrapping a visually-hidden file input: the native picker,
            the real keyboard behaviour, and the design system's button. */}
        <label className="cursor-pointer md:shrink-0">
          <span
            className={cx(
              "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-pill px-8 text-[1rem] font-semibold",
              "bg-[image:var(--gradient-cta)] text-on-brand shadow-brand",
              "transition-transform duration-[160ms] ease-out active:scale-[0.97]",
              uploading && "pointer-events-none opacity-50",
            )}
          >
            <Upload aria-hidden="true" className="size-4" />
            {uploading ? "Uploading…" : "Choose file"}
          </span>
          <input
            type="file"
            className="sr-only"
            disabled={uploading}
            accept=".pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff,.dcm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void upload(file);
            }}
          />
        </label>
      </Card>

      <div className="flex flex-wrap gap-2">
        {[{ value: "", label: "All" }, ...VAULT_TYPES].map((t) => (
          <button
            key={t.value || "all"}
            type="button"
            aria-pressed={filter === t.value}
            onClick={() => setFilter(t.value)}
            className={cx(
              "inline-flex min-h-10 cursor-pointer items-center rounded-pill px-4 text-label",
              "transition-[background-color,color,transform] duration-[160ms] ease-out active:scale-[0.97]",
              filter === t.value
                ? "bg-brand text-on-brand"
                : "bg-surface text-muted shadow-sm can-hover:hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingRegion label="Loading vault" className="flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Card key={i}>
              <Skeleton className="h-5 w-48" />
              <Skeleton className="mt-2 h-4 w-32" />
            </Card>
          ))}
        </LoadingRegion>
      ) : docs.length === 0 ? (
        <EmptyState
          title="No documents in this view"
          body="Add a report or scan so it is ready for your next consult."
          icon={<FolderClosed className="size-5" />}
        />
      ) : (
        <ul className="stagger flex flex-col gap-3">
          {docs.map((doc) => (
            <Card
              as="li"
              key={doc.id}
              className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-tint text-brand"
                >
                  <FileText className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-body font-semibold text-ink">{doc.filename}</p>
                  <p className="mt-0.5 text-body-sm text-muted">
                    {doc.document_type}
                    {doc.size_bytes ? ` · ${formatBytes(doc.size_bytes)}` : ""}
                    {doc.scan_status ? ` · ${doc.scan_status}` : ""}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  leading={<Download className="size-4" />}
                  onClick={() => void download(doc.id)}
                >
                  Download
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Delete ${doc.filename}`}
                  leading={<Trash2 className="size-4" />}
                  onClick={() => setPendingDelete(doc)}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </ul>
      )}

      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete this document?"
        description={
          pendingDelete
            ? `${pendingDelete.filename} is removed from your vault for good. Doctors you have already shared it with keep their copy.`
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingDelete(null)} disabled={deleting}>
              Keep it
            </Button>
            <Button
              variant="danger"
              busy={deleting}
              onClick={() => pendingDelete && void remove(pendingDelete.id)}
            >
              Delete
            </Button>
          </>
        }
      />
    </div>
  );
}
