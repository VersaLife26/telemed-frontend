import { parseEnvelope } from "@/lib/consumer/api/envelope";

export type ApplicationEligibility = {
  status: string;
  application_id?: string;
  message: string;
};

function readError(json: unknown, fallback: string): string {
  if (json && typeof json === "object" && "message" in json) {
    const message = (json as { message?: string }).message;
    if (message) return message;
  }
  return fallback;
}

/** Approved or activated applications may receive an OTP; all other statuses must not. */
export function canSendDoctorOtp(status: string): boolean {
  return status === "approved" || status === "activated";
}

export async function checkDoctorEligibility(phone: string): Promise<ApplicationEligibility> {
  const res = await fetch(
    `/api/proxy/doctors/applications/eligibility?phone=${encodeURIComponent(phone.trim())}`,
    { cache: "no-store" },
  );
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(readError(json, "Could not check registration status"));
  }
  return parseEnvelope<ApplicationEligibility>(json);
}
