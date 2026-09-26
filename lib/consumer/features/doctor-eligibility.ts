import { problemMessage } from "@/lib/consumer/api/errors";
import type { ApplicantEligibility } from "@/lib/consumer/api/types";

export type EligibilityStatus = ApplicantEligibility["status"];

/** Approved applicants and existing doctors may receive an OTP; all other statuses must not. */
export function canSendDoctorOtp(status: EligibilityStatus): boolean {
  return status === "approved" || status === "doctor";
}

export function eligibilityMessage(status: EligibilityStatus): string {
  switch (status) {
    case "none":
      return "No doctor application for this number. Apply to join first.";
    case "pending":
      return "Your application has been received and is waiting for review.";
    case "underReview":
      return "Your application is under review. We will contact you when it is decided.";
    case "rejected":
      return "Your application was not approved. Contact support for details.";
    case "approved":
    case "doctor":
      return "";
  }
}

export async function checkDoctorEligibility(phone: string): Promise<ApplicantEligibility & { message: string }> {
  const res = await fetch(
    `/api/proxy/doctor-applications/eligibility?phone=${encodeURIComponent(phone.trim())}`,
    { cache: "no-store" },
  );
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(problemMessage(json, "Could not check registration status"));
  }
  const data = json as ApplicantEligibility;
  return { ...data, message: eligibilityMessage(data.status) };
}
