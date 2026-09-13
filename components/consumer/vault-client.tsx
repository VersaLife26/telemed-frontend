"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/consumer/ui/Card";
import { Button } from "@/components/consumer/ui/Button";
import { EmptyState } from "@/components/consumer/ui/EmptyState";
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
    try {
      await browserApi(`/records/${id}`, { method: "DELETE" });
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-h3 text-ink">Health vault</h1>
        <p className="mt-1 text-body-sm text-text-muted">
          Upload reports and scans. Downloads use a short-lived link.
        </p>
      </header>

      {error ? <p className="text-body-sm text-danger">{error}</p> : null}

      <Card className="flex flex-col gap-3">
        <label className="text-body-sm font-medium text-ink" htmlFor="vault-type">
          Document type
        </label>
        <select
          id="vault-type"
          className="min-h-12 w-full rounded-[32px] border border-border bg-linen px-6 text-[16px] text-ink outline-none"
          value={docType}
          onChange={(e) => setDocType(e.target.value as typeof docType)}
        >
          {VAULT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <label className="cursor-pointer">
          <span className="inline-flex min-h-12 w-full items-center justify-center rounded-[32px] bg-primary px-6 text-[16px] font-bold text-white shadow-[var(--shadow-soft)] enabled:active:scale-[0.97]">
            {uploading ? "Uploading…" : "Choose file to upload"}
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
            onClick={() => setFilter(t.value)}
            className={cx(
              "inline-flex min-h-11 items-center rounded-[32px] px-5 text-body-sm",
              filter === t.value ? "bg-primary text-white" : "bg-paper text-text-muted",
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
      ) : null}

      {!loading
        ? docs.map((doc) => (
            <Card key={doc.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-body font-medium text-ink">{doc.filename}</p>
                <p className="text-body-sm text-text-muted">
                  {doc.document_type}
                  {doc.size_bytes ? ` · ${formatBytes(doc.size_bytes)}` : ""}
                  {doc.scan_status ? ` · ${doc.scan_status}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => void download(doc.id)}>
                  Download
                </Button>
                <Button type="button" variant="outline" onClick={() => void remove(doc.id)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))
        : null}

      {!loading && docs.length === 0 ? (
        <EmptyState
          title="No documents in this view"
          body="Add a report or scan so it is ready for your next consult."
        />
      ) : null}
    </div>
  );
}
