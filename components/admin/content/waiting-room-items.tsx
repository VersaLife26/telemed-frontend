"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CircleAlert, CircleCheck, FileText, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/admin/ui/alert";
import { DataTable } from "@/components/admin/data-table/data-table";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Checkbox } from "@/components/admin/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { Textarea } from "@/components/admin/ui/textarea";
import { proxyUrl, send } from "@/lib/admin/api/browser";
import { endpoints } from "@/lib/admin/api/endpoints";
import { ApiError, describeForToast, isApiError, toApiError } from "@/lib/admin/api/errors";
import { useApiMutation } from "@/lib/admin/api/hooks";
import type { WaitingRoomItem, WaitingRoomItemKind } from "@/lib/admin/api/types";

import { ContentDeleteButton } from "./content-delete-button";

type Draft = {
  kind: WaitingRoomItemKind;
  title: string;
  body: string;
  linkUrl: string;
  videoUrl: string;
  displayOrder: string;
  isActive: boolean;
};

const emptyDraft = (): Draft => ({
  kind: "article",
  title: "",
  body: "",
  linkUrl: "",
  videoUrl: "",
  displayOrder: "0",
  isActive: true,
});

function fromRow(row: WaitingRoomItem): Draft {
  return {
    kind: row.kind,
    title: row.title,
    body: row.body ?? "",
    linkUrl: row.linkUrl ?? "",
    videoUrl: row.videoUrl ?? "",
    displayOrder: String(row.displayOrder),
    isActive: row.isActive,
  };
}

function normalizeHttpUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const VIDEO_MAX_BYTES = 25 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 120_000;

function isValidHttpUrl(raw: string): boolean {
  const normalized = normalizeHttpUrl(raw);
  if (!normalized) return true;
  try {
    const url = new URL(normalized);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (url.hostname.includes(".")) return true;
    return url.hostname === "localhost";
  } catch {
    return false;
  }
}

function payload(draft: Draft) {
  return {
    kind: draft.kind,
    title: draft.title.trim(),
    body: draft.body.trim() || null,
    linkUrl: normalizeHttpUrl(draft.linkUrl),
    videoUrl: normalizeHttpUrl(draft.videoUrl),
    displayOrder: Number(draft.displayOrder),
    isActive: draft.isActive,
  };
}

type FieldKey = "title" | "body" | "linkUrl" | "videoUrl" | "displayOrder";

type SubmitFeedback = {
  tone: "success" | "error";
  title: string;
  description: string;
};

/** Signed API file URLs must load through the admin gateway, not the API host directly. */
function adminFileSrc(url?: string | null): string | null {
  if (!url?.trim()) return null;
  const raw = url.trim();
  if (raw.startsWith("blob:") || raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("/api/v1/")) return proxyUrl(raw);
  return proxyUrl(raw.startsWith("/") ? raw : `/api/v1/${raw}`);
}

function firstFieldError(errors: Record<string, string[]>, ...keys: string[]): string | null {
  for (const key of keys) {
    const message = errors[key]?.[0];
    if (message) return message;
  }
  return null;
}

export function WaitingRoomItemsSection({
  rows,
  readOnly,
}: {
  rows: WaitingRoomItem[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<WaitingRoomItem | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft>(emptyDraft);
  const [file, setFile] = React.useState<File | null>(null);
  const [videoFile, setVideoFile] = React.useState<File | null>(null);
  const [removeImage, setRemoveImage] = React.useState(false);
  const [removeVideo, setRemoveVideo] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Partial<Record<FieldKey, string>>>({});
  const [touched, setTouched] = React.useState<Partial<Record<FieldKey, boolean>>>({});
  const [mediaError, setMediaError] = React.useState<string | null>(null);
  const [submitFeedback, setSubmitFeedback] = React.useState<SubmitFeedback | null>(null);
  const feedbackRef = React.useRef<HTMLDivElement>(null);

  const deleteMutation = useApiMutation<void, string>({
    method: "DELETE",
    path: (id) => endpoints.content.waitingRoomItem(id),
    successMessage: () => "Waiting room item deleted.",
  });

  const open = creating || editing !== null;

  function close() {
    setCreating(false);
    setEditing(null);
    setFile(null);
    setVideoFile(null);
    setRemoveImage(false);
    setRemoveVideo(false);
    setFieldErrors({});
    setTouched({});
    setMediaError(null);
    setSubmitFeedback(null);
    setDraft(emptyDraft());
  }

  React.useEffect(() => {
    if (submitFeedback) {
      feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [submitFeedback]);

  function localProblem(field: FieldKey): string | null {
    if (field === "title" && draft.title.trim() === "") {
      return "Title is required.";
    }
    if (field === "body" && draft.kind === "article" && draft.body.trim() === "") {
      return "Articles need a body patients can read.";
    }
    if (field === "displayOrder" && !/^\d+$/.test(draft.displayOrder.trim())) {
      return "Display order must be a whole number.";
    }
    if (field === "linkUrl" && draft.linkUrl.trim() !== "" && !isValidHttpUrl(draft.linkUrl)) {
      return "Link must be an http or https URL.";
    }
    if (field === "videoUrl" && draft.videoUrl.trim() !== "" && !isValidHttpUrl(draft.videoUrl)) {
      return "Video must be an http or https URL.";
    }
    return null;
  }

  function problemFor(field: FieldKey): string | null {
    return fieldErrors[field] ?? (touched[field] ? localProblem(field) : null);
  }

  function collectLocalFieldErrors(): Partial<Record<FieldKey, string>> {
    const next: Partial<Record<FieldKey, string>> = {};
    for (const field of ["title", "body", "linkUrl", "videoUrl", "displayOrder"] as const) {
      const message = localProblem(field);
      if (message) next[field] = message;
    }
    return next;
  }

  function localMediaError(): string | null {
    if (file && file.size > IMAGE_MAX_BYTES) {
      return "Image must be at most 5 MB.";
    }
    if (videoFile && videoFile.size > VIDEO_MAX_BYTES) {
      return "Video must be at most 25 MB.";
    }
    return null;
  }

  function showSaveError(title: string, description: string) {
    setSubmitFeedback({ tone: "error", title, description });
    toast.error(title, { description });
  }

  function mediaUploadFailureMessage(error: ApiError, kind: "image" | "video"): string {
    const fileMessage = firstFieldError(error.errors, "file");
    if (fileMessage) return fileMessage;
    if (error.status === 404) {
      return kind === "video"
        ? "The live API does not support ad video uploads yet (404 Not Found). Ops needs to deploy the latest telemed-api. Until then, use Video URL for YouTube or a direct MP4 link."
        : "The image upload endpoint was not found (404). Deploy the latest telemed-api and try again.";
    }
    const parts = [error.userMessage];
    if (error.remedy) parts.push(error.remedy);
    if (error.traceId) parts.push(`Trace ID: ${error.traceId}`);
    return parts.join(" ");
  }

  const columns = React.useMemo<ColumnDef<WaitingRoomItem, unknown>[]>(
    () => [
      {
        accessorKey: "kind",
        header: "Type",
        cell: ({ row }) => (
          <Badge variant={row.original.kind === "ad" ? "muted" : "success"}>
            {row.original.kind === "ad" ? "Ad" : "Article"}
          </Badge>
        ),
      },
      { accessorKey: "title", header: "Title" },
      {
        id: "media",
        header: "Media",
        cell: ({ row }) => {
          const parts = [
            row.original.imageUrl ? "Image" : null,
            row.original.videoFileUrl || row.original.videoUrl ? "Video" : null,
            row.original.linkUrl ? "Link" : null,
          ].filter(Boolean);
          return parts.length > 0 ? parts.join(" · ") : "—";
        },
      },
      { accessorKey: "displayOrder", header: "Order" },
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) =>
          row.original.isActive ? (
            <Badge variant="success">Active</Badge>
          ) : (
            <Badge variant="muted">Inactive</Badge>
          ),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={readOnly}
              onClick={() => {
                setFieldErrors({});
                setTouched({});
                setSubmitFeedback(null);
                setMediaError(null);
                setFile(null);
                setVideoFile(null);
                setRemoveImage(false);
                setRemoveVideo(false);
                setEditing(row.original);
                setDraft(fromRow(row.original));
              }}
            >
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </Button>
            {row.original.isActive ? (
              <ContentDeleteButton
                disabled={readOnly}
                itemLabel="waiting room item"
                itemName={row.original.title}
                pending={deleteMutation.isPending}
                onConfirm={() => deleteMutation.mutate(row.original.id)}
              />
            ) : null}
          </div>
        ),
      },
    ],
    [readOnly, deleteMutation],
  );

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitFeedback(null);
    setMediaError(null);

    const markTouched: Partial<Record<FieldKey, boolean>> = {
      title: true,
      body: true,
      linkUrl: true,
      videoUrl: true,
      displayOrder: true,
    };
    setTouched(markTouched);

    const localErrors = collectLocalFieldErrors();
    const mediaProblem = localMediaError();
    if (Object.keys(localErrors).length > 0 || mediaProblem) {
      setFieldErrors(localErrors);
      if (mediaProblem) setMediaError(mediaProblem);
      const firstFieldMessage = Object.values(localErrors)[0];
      showSaveError(
        "Could not save yet",
        mediaProblem ?? firstFieldMessage ?? "Fix the highlighted fields below and try again.",
      );
      return;
    }

    setPending(true);
    setFieldErrors({});
    try {
      const saved = creating
        ? await send<WaitingRoomItem>("POST", endpoints.content.waitingRoomItem(), payload(draft))
        : await send<WaitingRoomItem>(
            "PUT",
            endpoints.content.waitingRoomItem(editing!.id),
            payload(draft),
          );

      let failedUploadKind: "image" | "video" = "image";
      try {
        if (file) {
          failedUploadKind = "image";
          const form = new FormData();
          form.append("file", file);
          await send<WaitingRoomItem>(
            "PUT",
            endpoints.content.waitingRoomItemImage(saved.id),
            form,
            { timeoutMs: UPLOAD_TIMEOUT_MS },
          );
        } else if (removeImage && editing?.imageUrl) {
          failedUploadKind = "image";
          await send("DELETE", endpoints.content.waitingRoomItemImage(editing.id));
        }

        if (videoFile) {
          failedUploadKind = "video";
          const form = new FormData();
          form.append("file", videoFile);
          await send<WaitingRoomItem>(
            "PUT",
            endpoints.content.waitingRoomItemVideo(saved.id),
            form,
            { timeoutMs: UPLOAD_TIMEOUT_MS },
          );
        } else if (removeVideo && editing?.videoFileUrl) {
          failedUploadKind = "video";
          await send("DELETE", endpoints.content.waitingRoomItemVideo(editing.id));
        }
      } catch (mediaCause) {
        const error = toApiError(mediaCause);
        const message = mediaUploadFailureMessage(error, failedUploadKind);
        setMediaError(message);
        router.refresh();
        if (creating && isApiError(mediaCause)) {
          setCreating(false);
          setEditing(saved);
        }
        showSaveError("Saved, but media upload failed", message);
        return;
      }

      const successTitle = creating ? "Waiting room item created" : "Changes saved";
      const successDescription = creating
        ? "Patients will see this item in the waiting room when it is active."
        : "Your waiting room item was updated successfully.";
      setSubmitFeedback({ tone: "success", title: successTitle, description: successDescription });
      toast.success(successTitle, { description: successDescription });
      router.refresh();
      window.setTimeout(() => close(), 1600);
    } catch (cause) {
      const error = toApiError(cause);
      setFieldErrors({
        title: firstFieldError(error.errors, "title") ?? undefined,
        body: firstFieldError(error.errors, "body") ?? undefined,
        linkUrl: firstFieldError(error.errors, "linkUrl") ?? undefined,
        videoUrl: firstFieldError(error.errors, "videoUrl") ?? undefined,
        displayOrder: firstFieldError(error.errors, "displayOrder") ?? undefined,
      });
      const fileMessage = firstFieldError(error.errors, "file");
      if (fileMessage) setMediaError(fileMessage);
      const { title, description } = describeForToast(error);
      showSaveError(
        title,
        description ??
          error.userMessage + (error.traceId ? ` Trace ID: ${error.traceId}` : ""),
      );
    } finally {
      setPending(false);
    }
  }

  const filePreview = React.useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  const videoPreview = React.useMemo(() => (videoFile ? URL.createObjectURL(videoFile) : null), [videoFile]);
  React.useEffect(
    () => () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    },
    [filePreview],
  );
  React.useEffect(
    () => () => {
      if (videoPreview) URL.revokeObjectURL(videoPreview);
    },
    [videoPreview],
  );
  const preview = filePreview ?? (!removeImage ? adminFileSrc(editing?.imageUrl) : null);
  const uploadedVideo = videoPreview ?? (!removeVideo ? adminFileSrc(editing?.videoFileUrl) : null);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Waiting room</h2>
          <p className="text-sm text-muted-foreground">
            Articles and ads patients can read or watch while they wait to be admitted.
          </p>
        </div>
        <Button
          size="sm"
          disabled={readOnly}
          onClick={() => {
            setFieldErrors({});
            setTouched({});
            setSubmitFeedback(null);
            setMediaError(null);
            setFile(null);
            setVideoFile(null);
            setRemoveImage(false);
            setRemoveVideo(false);
            setDraft(emptyDraft());
            setCreating(true);
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
          New item
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        caption="Waiting room"
        emptyState={
          <EmptyState
            icon={FileText}
            title="No waiting room items yet"
            description="Create an article or an ad with the button above."
          />
        }
      />

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && !pending) close();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{creating ? "New waiting room item" : "Edit waiting room item"}</DialogTitle>
            <DialogDescription>
              Articles need a title and body. Ads can include an image, an uploaded video, a video
              URL, and a link.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
            {submitFeedback ? (
              <div ref={feedbackRef}>
                <Alert variant={submitFeedback.tone === "success" ? "success" : "destructive"}>
                  {submitFeedback.tone === "success" ? (
                    <CircleCheck aria-hidden="true" />
                  ) : (
                    <CircleAlert aria-hidden="true" />
                  )}
                  <AlertTitle>{submitFeedback.title}</AlertTitle>
                  <AlertDescription>{submitFeedback.description}</AlertDescription>
                </Alert>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="wr-kind">Type</Label>
              <Select
                value={draft.kind}
                onValueChange={(value) =>
                  setDraft((current) => ({ ...current, kind: value as WaitingRoomItemKind }))
                }
              >
                <SelectTrigger id="wr-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="article">Article</SelectItem>
                  <SelectItem value="ad">Ad</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wr-title">
                Title <span aria-hidden="true">*</span>
              </Label>
              <Input
                id="wr-title"
                value={draft.title}
                required
                aria-invalid={problemFor("title") !== null}
                onBlur={() => setTouched((current) => ({ ...current, title: true }))}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              />
              {problemFor("title") ? (
                <p className="text-xs text-destructive">{problemFor("title")}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wr-body">Body{draft.kind === "article" ? " *" : ""}</Label>
              <Textarea
                id="wr-body"
                rows={6}
                value={draft.body}
                required={draft.kind === "article"}
                aria-invalid={problemFor("body") !== null}
                placeholder={
                  draft.kind === "article"
                    ? "What should the patient read while they wait?"
                    : "Optional short copy for the ad."
                }
                onBlur={() => setTouched((current) => ({ ...current, body: true }))}
                onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
              />
              {problemFor("body") ? (
                <p className="text-xs text-destructive">{problemFor("body")}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wr-image">Image</Label>
              {preview ? (
                <img
                  src={preview}
                  alt=""
                  className="h-32 w-full rounded-md object-cover"
                />
              ) : null}
              <Input
                id="wr-image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setRemoveImage(false);
                }}
              />
              <p className="text-xs text-muted-foreground">JPEG, PNG or WebP, up to 5 MB.</p>
              {mediaError && file ? <p className="text-xs text-destructive">{mediaError}</p> : null}
              {editing?.imageUrl && !file ? (
                <div className="flex items-center gap-2 text-sm">
                  <Checkbox
                    id="wr-remove-image"
                    checked={removeImage}
                    onCheckedChange={(next) => setRemoveImage(next === true)}
                  />
                  <Label htmlFor="wr-remove-image" className="font-normal">
                    Remove current image
                  </Label>
                </div>
              ) : null}
            </div>

            {draft.kind === "ad" ? (
              <div className="space-y-1.5">
                <Label htmlFor="wr-video-file">Ad video</Label>
                {uploadedVideo ? (
                  <video
                    className="h-32 w-full rounded-md bg-black object-contain"
                    src={uploadedVideo}
                    controls
                    aria-label="Ad video preview"
                  >
                    <track kind="captions" label="Captions not provided" />
                  </video>
                ) : null}
                <Input
                  id="wr-video-file"
                  type="file"
                  accept="video/mp4,video/webm"
                  onChange={(event) => {
                    setVideoFile(event.target.files?.[0] ?? null);
                    setRemoveVideo(false);
                  }}
                />
                <p className="text-xs text-muted-foreground">MP4 or WebM, up to 25 MB. Plays in the waiting room.</p>
                {mediaError && videoFile ? <p className="text-xs text-destructive">{mediaError}</p> : null}
                {editing?.videoFileUrl && !videoFile ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Checkbox
                      id="wr-remove-video"
                      checked={removeVideo}
                      onCheckedChange={(next) => setRemoveVideo(next === true)}
                    />
                    <Label htmlFor="wr-remove-video" className="font-normal">
                      Remove current video
                    </Label>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="wr-video">Video URL</Label>
              <Input
                id="wr-video"
                value={draft.videoUrl}
                placeholder="https://…"
                aria-invalid={problemFor("videoUrl") !== null}
                onBlur={() => setTouched((current) => ({ ...current, videoUrl: true }))}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, videoUrl: event.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Optional YouTube or other link. Ads can also upload a video file above.
              </p>
              {problemFor("videoUrl") ? (
                <p className="text-xs text-destructive">{problemFor("videoUrl")}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wr-link">Link URL</Label>
              <Input
                id="wr-link"
                value={draft.linkUrl}
                placeholder="https://versalifehealth.com"
                aria-invalid={problemFor("linkUrl") !== null}
                onBlur={() => setTouched((current) => ({ ...current, linkUrl: true }))}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, linkUrl: event.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                You can paste a domain like <span className="font-mono">www.example.com</span>; https is added
                automatically.
              </p>
              {problemFor("linkUrl") ? (
                <p className="text-xs text-destructive">{problemFor("linkUrl")}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wr-order">Display order</Label>
              <Input
                id="wr-order"
                value={draft.displayOrder}
                aria-invalid={problemFor("displayOrder") !== null}
                onBlur={() => setTouched((current) => ({ ...current, displayOrder: true }))}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, displayOrder: event.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">Lower numbers are listed first.</p>
              {problemFor("displayOrder") ? (
                <p className="text-xs text-destructive">{problemFor("displayOrder")}</p>
              ) : null}
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="wr-active"
                checked={draft.isActive}
                onCheckedChange={(next) =>
                  setDraft((current) => ({ ...current, isActive: next === true }))
                }
              />
              <div>
                <Label htmlFor="wr-active">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive items stay in this console but are hidden from patients.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : creating ? "Create" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
