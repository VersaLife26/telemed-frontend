import type { Sex, TelemedUser } from "@/lib/consumer/api/types";

export type ProfileDraft = {
  name: string;
  phone: string;
  address: string;
  dateOfBirth: string;
  sex: Sex | "";
  allergies: string;
};

export const MAX_PROFILE_PHOTO_BYTES = 2 * 1024 * 1024;

const ALLOWED_PROFILE_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function profileDraftFromUser(user: TelemedUser): ProfileDraft {
  return {
    name: user.name || "",
    phone: user.phone || "",
    address: user.address || "",
    dateOfBirth: user.date_of_birth || "",
    sex: user.sex || "",
    allergies: user.allergies || "",
  };
}

export function profileUpdateError(draft: ProfileDraft): string | null {
  if (!draft.name.trim()) return "Enter your name.";
  if (draft.address.length > 500) return "Address must be 500 characters or fewer.";
  if (draft.allergies.length > 1000) return "Allergies must be 1000 characters or fewer.";
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

export function profileUpdateBody(user: TelemedUser, draft: ProfileDraft) {
  return {
    name: draft.name.trim(),
    phone: draft.phone.trim(),
    address: draft.address.trim(),
    date_of_birth: draft.dateOfBirth.trim(),
    sex: draft.sex,
    allergies: draft.allergies.trim(),
    language: user.language || "en",
    version: user.version ?? 0,
  };
}

/** Turns the API's relative photo path into a same-origin BFF URL. */
export function profilePhotoSrc(photoUrl?: string | null): string | null {
  if (!photoUrl?.trim()) return null;
  const raw = photoUrl.trim();
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("/api/proxy/")) {
    return raw;
  }
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `/api/proxy${path}`;
}

export function profilePhotoError(file: File | null): string | null {
  if (!file) return "Choose a photo to upload.";
  if (!ALLOWED_PROFILE_PHOTO_TYPES.has(file.type)) {
    return "Use a JPEG, PNG, or WebP image.";
  }
  if (file.size > MAX_PROFILE_PHOTO_BYTES) {
    return "Photo must be 2 MB or smaller.";
  }
  return null;
}
