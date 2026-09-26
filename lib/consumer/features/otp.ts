export function sendOtpError(phone?: string): string | null {
  if (!phone?.trim()) return "Phone is required";
  return null;
}

export function sendOtpBody(phone: string) {
  return {
    phone: phone.trim(),
    language: "en" as const,
  };
}

export function verifyOtpError(phone?: string, code?: string): string | null {
  if (!phone?.trim() || !code?.trim()) return "Phone and OTP are required";
  return null;
}

export function verifyOtpBody(phone: string, code: string) {
  return {
    phone: phone.trim(),
    code: code.trim(),
  };
}

export function missingTokensMessage(): string {
  return "OTP verify response missing tokens";
}
