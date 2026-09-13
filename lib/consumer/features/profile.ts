import type { TelemedUser } from "@/lib/consumer/api/types";

export type ProfileDraft = {
  name: string;
  phone: string;
  address: string;
  dateOfBirth: string;
};

export function profileDraftFromUser(user: TelemedUser): ProfileDraft {
  return {
    name: user.name || "",
    phone: user.phone || "",
    address: user.address || "",
    dateOfBirth: user.date_of_birth || "",
  };
}

export function profileUpdateError(draft: ProfileDraft): string | null {
  if (!draft.name.trim()) return "Enter your name.";
  if (draft.address.length > 500) return "Address must be 500 characters or fewer.";
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
    language: user.language || "en",
    version: user.version ?? 0,
  };
}
