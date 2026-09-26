import type { Sex, TelemedUser } from "@/lib/consumer/api/types";
import type { components } from "@/lib/api/schema";

type UpdateMeRequest = components["schemas"]["UpdateMeRequest"];

export type ProfileDraft = {
  name: string;
  address: string;
  dateOfBirth: string;
  sex: Sex | "";
  allergies: string;
};

export const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;

const ALLOWED_PROFILE_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function profileDraftFromUser(user: TelemedUser): ProfileDraft {
  return {
    name: user.fullName || "",
    address: user.address || "",
    dateOfBirth: user.dateOfBirth || "",
    sex: user.sex || "",
    allergies: user.allergies || "",
  };
}

export function profileUpdateError(draft: ProfileDraft): string | null {
  if (!draft.name.trim()) return "Enter your name.";
  if (draft.name.trim().length > 200) return "Name must be 200 characters or fewer.";
  if (draft.address.length > 500) return "Address must be 500 characters or fewer.";
  if (draft.allergies.length > 2000) return "Allergies must be 2000 characters or fewer.";
  if (draft.dateOfBirth) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.dateOfBirth)) {
      return "Date of birth must be a valid date.";
    }
    if (draft.dateOfBirth > new Date().toISOString().slice(0, 10)) {
      return "Date of birth cannot be in the future.";
    }
  }
  return null;
}

/** Phone and email are sign-in identities and cannot be changed through PUT /me. */
export function profileUpdateBody(user: TelemedUser, draft: ProfileDraft): UpdateMeRequest {
  return {
    fullName: draft.name.trim(),
    address: draft.address.trim() || null,
    dateOfBirth: draft.dateOfBirth.trim() || null,
    sex: draft.sex || null,
    allergies: draft.allergies.trim() || null,
    language: user.language || "en",
    version: user.version ?? "",
  };
}

/**
 * Photo URLs arrive as short-lived signed API paths (`/api/v1/files/…`);
 * the browser reaches them through the same-origin BFF proxy.
 */
export function profilePhotoSrc(photoUrl?: string | null): string | null {
  if (!photoUrl?.trim()) return null;
  const raw = photoUrl.trim();
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("/api/proxy/")) {
    return raw;
  }
  const path = raw.replace(/^\/?(api\/v1\/)?/, "");
  return `/api/proxy/${path}`;
}

export function profilePhotoError(file: File | null): string | null {
  if (!file) return "Choose a photo to upload.";
  if (!ALLOWED_PROFILE_PHOTO_TYPES.has(file.type)) {
    return "Use a JPEG, PNG, or WebP image.";
  }
  if (file.size > MAX_PROFILE_PHOTO_BYTES) {
    return "Photo must be 5 MB or smaller.";
  }
  return null;
}
