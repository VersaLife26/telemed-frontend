"use client";

import {
  FileAudio,
  FileText,
  FileVideo,
  FolderPlus,
  Grid2x2,
  Image as ImageIcon,
  List,
  Pencil,
  Search,
  Trash2,
  Upload,
  Folder as FolderIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { FilePreview, presignedUrl, previewObjectUrl } from "@/components/consumer/vault/file-preview";
import type { CallPointerBind } from "@/lib/consumer/features/pointer";
import { Alert } from "@/components/consumer/ui/Alert";
import { Button } from "@/components/consumer/ui/Button";
import { EmptyState } from "@/components/consumer/ui/EmptyState";
import { Input } from "@/components/consumer/ui/Input";
import { Modal } from "@/components/consumer/ui/Modal";
import { Select } from "@/components/consumer/ui/Select";
import { browserApi } from "@/lib/consumer/api/client";
import type { Paged, VaultDocument, VaultFolder, VaultPatient } from "@/lib/consumer/api/types";
import { useOptionalCall } from "@/components/consumer/call/call-provider";
import { cx } from "@/lib/consumer/cx";
import {
  UPLOAD_ACCEPT,
  VAULT_TYPES,
  childFolders,
  documentsListPath,
  folderCrumbs,
  foldersListPath,
  formatBytes,
  patientsListPath,
  previewKind,
  scopedPatients,
  uploadError,
  type VaultDocType,
} from "@/lib/consumer/features/vault";

export type VaultMode = "owner" | "doctor";

export function VaultBrowser({
  ownerUserId,
  mode,
  compact = false,
  lockedRoot,
  onOpenFile,
  dark = false,
  pointer,
}: {
  ownerUserId?: string;
  mode: VaultMode;
  compact?: boolean;
  lockedRoot?: string | null;
  onOpenFile?: (doc: VaultDocument) => void;
  dark?: boolean;
  pointer?: CallPointerBind | null;
}) {
  const owner = lockedRoot || ownerUserId;
  const canMutate = mode === "owner";
  const liveCall = useOptionalCall();
  const [patients, setPatients] = useState<VaultPatient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string | undefined>(owner);
  const vaultOwner = mode === "doctor" ? selectedPatient : owner;

  const [folderId, setFolderId] = useState<string | null>(null);
  const [allFolders, setAllFolders] = useState<VaultFolder[]>([]);
  const [docs, setDocs] = useState<VaultDocument[]>([]);
  const [filter, setFilter] = useState("");
  const [query, setQuery] = useState("");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [docType, setDocType] = useState<VaultDocType>("report");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<VaultDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<VaultDocument | VaultFolder | null>(null);
  const [renaming, setRenaming] = useState<{ kind: "file" | "folder"; id: string; name: string } | null>(
    null,
  );
  const [moving, setMoving] = useState<{ kind: "file" | "folder"; id: string } | null>(null);
  const [newFolder, setNewFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const dropRef = useRef<HTMLDivElement>(null);

  const loadPatients = useCallback(async () => {
    if (mode !== "doctor") return;
    if (lockedRoot) {
      setSelectedPatient(lockedRoot);
      return;
    }
    const list = scopedPatients(await browserApi<VaultPatient[]>(patientsListPath()), lockedRoot);
    setPatients(list);
    setSelectedPatient((current) => {
      if (current && list.some((p) => p.patientId === current)) return current;
      return list[0]?.patientId;
    });
  }, [lockedRoot, mode]);

  const load = useCallback(async () => {
    if (mode === "doctor" && !vaultOwner) {
      setAllFolders([]);
      setDocs([]);
      return;
    }
    const [folderList, page] = await Promise.all([
      browserApi<VaultFolder[]>(foldersListPath(vaultOwner)),
      browserApi<Paged<VaultDocument>>(documentsListPath(filter, folderId, vaultOwner)),
    ]);
    setAllFolders(folderList);
    setDocs(page.items);
  }, [filter, folderId, mode, vaultOwner]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await loadPatients();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load patients");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPatients]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await load();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load vault");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    if (!preview) {
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | undefined;
    previewObjectUrl(preview.id)
      .then((url) => {
        objectUrl = url;
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        setPreviewUrl(url);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Preview failed");
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [preview]);

  const crumbs = folderCrumbs(allFolders, folderId);
  const shownFolders = useMemo(
    () =>
      childFolders(allFolders, folderId).filter((f) =>
        f.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [allFolders, folderId, query],
  );
  const shownDocs = useMemo(
    () => docs.filter((d) => d.fileName.toLowerCase().includes(query.toLowerCase())),
    [docs, query],
  );

  async function uploadTo(file: File, targetFolder: string | null = folderId) {
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
      form.append("documentType", docType);
      if (mode === "doctor" && vaultOwner) form.append("patientId", vaultOwner);
      if (targetFolder) form.append("folderId", targetFolder);
      await browserApi<VaultDocument>("/vault/documents", { method: "POST", body: form });
      if (liveCall?.activeId && liveCall.call.live) liveCall.call.announceFile(file.name);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function download(doc: VaultDocument) {
    try {
      const link = document.createElement("a");
      link.href = await presignedUrl(doc.id);
      link.download = doc.fileName;
      link.click();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    }
  }

  function openFile(doc: VaultDocument) {
    if (onOpenFile) {
      onOpenFile(doc);
      return;
    }
    setPreview(doc);
  }

  async function createFolder() {
    try {
      await browserApi<VaultFolder>("/vault/folders", {
        method: "POST",
        body: { name: folderName.trim(), parentId: folderId },
      });
      setNewFolder(false);
      setFolderName("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create folder");
    }
  }

  async function applyRename() {
    if (!renaming) return;
    try {
      if (renaming.kind === "folder") {
        await browserApi<VaultFolder>(`/vault/folders/${renaming.id}`, {
          method: "PATCH",
          body: { name: renaming.name.trim(), parentId: null },
        });
      } else {
        await browserApi<VaultDocument>(`/vault/documents/${renaming.id}`, {
          method: "PATCH",
          body: { fileName: renaming.name.trim(), folderId: null },
        });
      }
      setRenaming(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rename failed");
    }
  }

  /** `null` in these PATCH bodies means "unchanged"; the vault root is `root`. */
  async function applyMove(target: string | null) {
    if (!moving) return;
    try {
      if (moving.kind === "folder") {
        await browserApi<VaultFolder>(`/vault/folders/${moving.id}`, {
          method: "PATCH",
          body: { name: null, parentId: target ?? "root" },
        });
      } else {
        await browserApi<VaultDocument>(`/vault/documents/${moving.id}`, {
          method: "PATCH",
          body: { fileName: null, folderId: target ?? "root" },
        });
      }
      setMoving(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Move failed");
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      if ("fileName" in pendingDelete) {
        await browserApi<void>(`/vault/documents/${pendingDelete.id}`, { method: "DELETE" });
      } else {
        await browserApi<void>(`/vault/folders/${pendingDelete.id}`, { method: "DELETE" });
      }
      setPendingDelete(null);
      if (preview && "fileName" in pendingDelete && preview.id === pendingDelete.id) {
        setPreview(null);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
    }
  }

  const text = dark ? "text-white" : "text-ink";
  const muted = dark ? "text-white/60" : "text-muted";
  const ghost = dark
    ? "min-h-9 min-w-9 text-white/80 can-hover:hover:bg-white/10 can-hover:hover:text-white"
    : "min-h-9 min-w-9";
  const field = dark
    ? "border-white/15 bg-white/10 text-white placeholder:text-white/40 focus:shadow-none"
    : undefined;

  return (
    <div className="@container flex min-h-0 flex-1 flex-col">
      <div className={cx("flex min-h-0 flex-1", compact ? "flex-col" : "flex-col @3xl:flex-row")}>
        {mode === "doctor" && !compact ? (
          <aside className={cx("w-full shrink-0 border-b p-3 @3xl:w-56 @3xl:border-b-0 @3xl:border-r", dark ? "border-white/10" : "border-border-subtle")}>
            <p className={cx("mb-2 text-caption uppercase", muted)}>Patients</p>
            {lockedRoot ? (
              <p className={cx("text-label", text)}>
                {patients.find((p) => p.patientId === lockedRoot)?.fullName || "Current patient"}
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {patients.map((patient) => (
                  <li key={patient.patientId}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPatient(patient.patientId);
                        setFolderId(null);
                      }}
                      className={cx(
                        "min-h-11 w-full rounded-md px-3 py-2 text-left text-body-sm",
                        selectedPatient === patient.patientId
                          ? "bg-brand text-on-brand"
                          : dark
                            ? "text-white/80 can-hover:hover:bg-white/10"
                            : "can-hover:hover:bg-tint",
                      )}
                    >
                      {patient.fullName || "Unnamed"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        ) : null}

        <div
          ref={dropRef}
          className="flex min-w-0 flex-1 flex-col"
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files[0];
            if (file) void uploadTo(file);
          }}
        >
          <div className="flex flex-wrap items-center gap-2 p-3">
            <nav aria-label="Folder path" className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-body-sm">
              {crumbs.map((crumb, index) => (
                <span key={crumb.id ?? "root"} className="flex items-center gap-1">
                  {index > 0 ? <span className={muted}>/</span> : null}
                  <button
                    type="button"
                    className={cx("min-h-9 truncate rounded-md px-1", index === crumbs.length - 1 ? text : muted, dark && "can-hover:hover:bg-white/10")}
                    onClick={() => setFolderId(crumb.id)}
                  >
                    {crumb.name}
                  </button>
                </span>
              ))}
            </nav>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className={ghost}
                aria-pressed={layout === "grid"}
                aria-label="Grid"
                onClick={() => setLayout("grid")}
                leading={<Grid2x2 className="size-4" />}
              />
              <Button
                variant="ghost"
                size="sm"
                className={ghost}
                aria-pressed={layout === "list"}
                aria-label="List"
                onClick={() => setLayout("list")}
                leading={<List className="size-4" />}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-3 pb-3">
            <Input
              icon={<Search className="size-4" />}
              placeholder="Search this folder"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={cx("min-w-[12rem] flex-1", field)}
            />
            <Select
              aria-label="Document type filter"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className={field}
            >
              <option value="">All types</option>
              {VAULT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
            {canMutate || mode === "doctor" ? (
              <>
                <Select
                  aria-label="Upload as"
                  value={docType}
                  onChange={(event) => setDocType(event.target.value as VaultDocType)}
                  className={field}
                >
                  {VAULT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </Select>
                <Button
                  size="sm"
                  busy={uploading}
                  leading={<Upload className="size-4" />}
                  onClick={() => dropRef.current?.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
                >
                  Upload
                </Button>
                <input
                  type="file"
                  accept={UPLOAD_ACCEPT}
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadTo(file);
                    event.target.value = "";
                  }}
                />
              </>
            ) : null}
            {canMutate ? (
              <Button
                size="sm"
                variant="secondary"
                leading={<FolderPlus className="size-4" />}
                onClick={() => setNewFolder(true)}
              >
                New folder
              </Button>
            ) : null}
          </div>

          {error ? (
            <Alert tone="danger" title="Vault" className="mx-3 mb-3">
              {error}
            </Alert>
          ) : null}

          {loading ? (
            <p className={cx("p-6 text-body", muted)}>Loading…</p>
          ) : shownFolders.length === 0 && shownDocs.length === 0 ? (
            <EmptyState
              title="This folder is empty"
              body="Drop a file here or upload one to keep it with this visit."
              icon={<FolderIcon className="size-5" />}
              tone={dark ? "dark" : "light"}
            />
          ) : layout === "grid" ? (
            <ul className="grid grid-cols-2 gap-3 p-3 @md:grid-cols-3 @xl:grid-cols-4">
              {shownFolders.map((folder) => (
                <li key={folder.id}>
                  <VaultTile
                    name={folder.name}
                    meta="Folder"
                    icon={<FolderIcon className="size-8 text-amber-500" />}
                    dark={dark}
                    onOpen={() => setFolderId(folder.id)}
                    onDropFile={(file) => void uploadTo(file, folder.id)}
                    canMutate={canMutate}
                    onRename={() => setRenaming({ kind: "folder", id: folder.id, name: folder.name })}
                    onMove={() => setMoving({ kind: "folder", id: folder.id })}
                    onDelete={() => setPendingDelete(folder)}
                  />
                </li>
              ))}
              {shownDocs.map((doc) => (
                <li key={doc.id}>
                  <VaultTile
                    name={doc.fileName}
                    meta={[doc.documentType, formatBytes(doc.sizeBytes)].filter(Boolean).join(" · ")}
                    icon={<TypeIcon type={doc.contentType} />}
                    thumbId={previewKind(doc.contentType) === "image" ? doc.id : null}
                    dark={dark}
                    onOpen={() => openFile(doc)}
                    canMutate={canMutate}
                    onRename={() => setRenaming({ kind: "file", id: doc.id, name: doc.fileName })}
                    onMove={() => setMoving({ kind: "file", id: doc.id })}
                    onDelete={() => setPendingDelete(doc)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <ul className={cx("divide-y", dark ? "divide-white/10" : "divide-border-subtle")}>
              {shownFolders.map((folder) => (
                <Row
                  key={folder.id}
                  name={folder.name}
                  meta="Folder"
                  icon={<FolderIcon className="size-5 text-amber-500" />}
                  dark={dark}
                  onOpen={() => setFolderId(folder.id)}
                  canMutate={canMutate}
                  onRename={() => setRenaming({ kind: "folder", id: folder.id, name: folder.name })}
                  onMove={() => setMoving({ kind: "folder", id: folder.id })}
                  onDelete={() => setPendingDelete(folder)}
                />
              ))}
              {shownDocs.map((doc) => (
                <Row
                  key={doc.id}
                  name={doc.fileName}
                  meta={[doc.documentType, formatBytes(doc.sizeBytes), doc.createdAt.slice(0, 10)]
                    .filter(Boolean)
                    .join(" · ")}
                  icon={<TypeIcon type={doc.contentType} />}
                  dark={dark}
                  onOpen={() => openFile(doc)}
                  canMutate={canMutate}
                  onRename={() => setRenaming({ kind: "file", id: doc.id, name: doc.fileName })}
                  onMove={() => setMoving({ kind: "file", id: doc.id })}
                  onDelete={() => setPendingDelete(doc)}
                />
              ))}
            </ul>
          )}
        </div>

        {preview && !onOpenFile ? (
          <div
            className={cx(
              "flex min-h-[16rem] flex-col border-t @3xl:w-[28rem] @3xl:border-l @3xl:border-t-0",
              dark ? "border-white/10" : "border-border-subtle",
              compact && "fixed inset-x-0 bottom-0 z-30 max-h-[70vh] rounded-t-xl bg-surface shadow-lg",
            )}
          >
            <FilePreview
              doc={preview}
              url={previewUrl}
              dark={dark}
              pointer={pointer}
              onDownload={() => void download(preview)}
            />
            <Button variant="ghost" size="sm" className={cx("m-2 self-end", ghost)} onClick={() => setPreview(null)}>
              Close
            </Button>
          </div>
        ) : null}

        <Modal
          open={newFolder}
          onClose={() => setNewFolder(false)}
          title="New folder"
          footer={
            <Button onClick={() => void createFolder()} disabled={!folderName.trim()}>
              Create
            </Button>
          }
        >
          <Input label="Name" value={folderName} onChange={(event) => setFolderName(event.target.value)} />
        </Modal>

        <Modal
          open={Boolean(renaming)}
          onClose={() => setRenaming(null)}
          title="Rename"
          footer={
            <Button onClick={() => void applyRename()} disabled={!renaming?.name.trim()}>
              Save
            </Button>
          }
        >
          <Input
            label="Name"
            value={renaming?.name ?? ""}
            onChange={(event) =>
              setRenaming((current) => (current ? { ...current, name: event.target.value } : current))
            }
          />
        </Modal>

        <Modal
          open={Boolean(moving)}
          onClose={() => setMoving(null)}
          title="Move to folder"
          footer={
            <>
              <Button variant="secondary" onClick={() => void applyMove(null)}>
                Vault root
              </Button>
              {allFolders
                .filter((folder) => folder.id !== moving?.id)
                .map((folder) => (
                  <Button key={folder.id} variant="outline" onClick={() => void applyMove(folder.id)}>
                    {folder.name}
                  </Button>
                ))}
            </>
          }
        >
          <p>Choose a folder in this vault. Files cannot move between patients.</p>
        </Modal>

        <Modal
          open={Boolean(pendingDelete)}
          onClose={() => setPendingDelete(null)}
          title="Delete?"
          description={
            pendingDelete && "fileName" in pendingDelete
              ? `Delete ${pendingDelete.fileName}? This cannot be undone.`
              : pendingDelete
                ? `Delete folder ${(pendingDelete as VaultFolder).name}? It must be empty.`
                : undefined
          }
          footer={
            <Button variant="danger" onClick={() => void confirmDelete()}>
              Delete
            </Button>
          }
        />
      </div>
    </div>
  );
}

function TypeIcon({ type }: { type?: string }) {
  const kind = previewKind(type);
  if (kind === "image") return <ImageIcon className="size-8 text-teal-500" />;
  if (kind === "video") return <FileVideo className="size-8 text-brand" />;
  if (kind === "audio") return <FileAudio className="size-8 text-amber-500" />;
  return <FileText className="size-8 text-ink-400" />;
}

/** Image tiles need their own signed link; the old authenticated byte stream is gone. */
function Thumb({ id }: { id: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    presignedUrl(id)
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [id]);
  if (!src) return <span className="block h-20 w-full rounded-md bg-ink-50" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="h-20 w-full rounded-md object-cover" />;
}

function VaultTile({
  name,
  meta,
  icon,
  thumbId,
  dark,
  onOpen,
  onDropFile,
  canMutate,
  onRename,
  onMove,
  onDelete,
}: {
  name: string;
  meta: string;
  icon: ReactNode;
  thumbId?: string | null;
  dark: boolean;
  onOpen: () => void;
  onDropFile?: (file: File) => void;
  canMutate: boolean;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cx(
        "group flex flex-col gap-2 rounded-lg p-3 text-left",
        dark ? "bg-white/5 can-hover:hover:bg-white/10" : "bg-tint can-hover:hover:bg-blue-100",
      )}
      onDragOver={(event) => {
        if (!onDropFile) return;
        event.preventDefault();
        event.stopPropagation();
      }}
      onDrop={(event) => {
        if (!onDropFile) return;
        event.preventDefault();
        event.stopPropagation();
        const file = event.dataTransfer.files[0];
        if (file) onDropFile(file);
      }}
    >
      <button type="button" onClick={onOpen} className="flex flex-col items-start gap-2 text-left">
        {thumbId ? (
          <Thumb id={thumbId} />
        ) : (
          <span className="flex h-20 w-full items-center justify-center">{icon}</span>
        )}
        <span className={cx("w-full truncate text-label", dark ? "text-white" : "text-ink")}>{name}</span>
        <span className={cx("text-caption", dark ? "text-white/50" : "text-muted")}>{meta}</span>
      </button>
      {canMutate ? (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
          <IconBtn label="Rename" onClick={onRename} dark={dark}>
            <Pencil className="size-3.5" />
          </IconBtn>
          <IconBtn label="Move" onClick={onMove} dark={dark}>
            <FolderIcon className="size-3.5" />
          </IconBtn>
          <IconBtn label="Delete" onClick={onDelete} dark={dark}>
            <Trash2 className="size-3.5" />
          </IconBtn>
        </div>
      ) : null}
    </div>
  );
}

function Row({
  name,
  meta,
  icon,
  dark,
  onOpen,
  canMutate,
  onRename,
  onMove,
  onDelete,
}: {
  name: string;
  meta: string;
  icon: ReactNode;
  dark: boolean;
  onOpen: () => void;
  canMutate: boolean;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex min-h-11 items-center gap-3 px-4 py-2">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        {icon}
        <span className="min-w-0">
          <span className={cx("block truncate text-label", dark ? "text-white" : "text-ink")}>{name}</span>
          <span className={cx("block truncate text-caption", dark ? "text-white/50" : "text-muted")}>{meta}</span>
        </span>
      </button>
      {canMutate ? (
        <span className="flex gap-1">
          <IconBtn label="Rename" onClick={onRename} dark={dark}>
            <Pencil className="size-3.5" />
          </IconBtn>
          <IconBtn label="Move" onClick={onMove} dark={dark}>
            <FolderIcon className="size-3.5" />
          </IconBtn>
          <IconBtn label="Delete" onClick={onDelete} dark={dark}>
            <Trash2 className="size-3.5" />
          </IconBtn>
        </span>
      ) : null}
    </li>
  );
}

function IconBtn({
  label,
  onClick,
  dark,
  children,
}: {
  label: string;
  onClick: () => void;
  dark?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cx(
        "flex size-9 items-center justify-center rounded-full",
        dark
          ? "text-white/55 can-hover:hover:bg-white/10 can-hover:hover:text-white"
          : "text-faint can-hover:hover:bg-surface can-hover:hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
