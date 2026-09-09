export function sendOtpError(phone?: string): string | null {
  if (!phone?.trim()) return "Phone is required";
  return null;
}

export function sendOtpBody(phone: string, purpose?: string) {
  return {
    phone: phone.trim(),
    purpose: purpose || "login",
    language: "en" as const,
  };
}

export function verifyOtpError(phone?: string, otp?: string, code?: string): string | null {
  const trimmedPhone = phone?.trim();
  const trimmedOtp = (otp || code || "").trim();
  if (!trimmedPhone || !trimmedOtp) return "Phone and OTP are required";
  return null;
}

export function verifyOtpBody(phone: string, otp: string, purpose?: string) {
  return {
    phone: phone.trim(),
    otp: otp.trim(),
    purpose: purpose || "login",
  };
}

export function missingTokensMessage(): string {
  return "OTP verify response missing tokens";
}
