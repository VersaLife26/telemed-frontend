export function bookingError(slotId: string): string | null {
  if (!slotId) return "Pick a time on the doctor’s page first.";
  return null;
}

export function bookingBody(slotId: string, doctorId: string, symptoms: string) {
  return {
    slot_id: slotId,
    doctor_id: doctorId,
    intake: { symptoms },
  };
}

export function paymentPath(appointmentId: string): string {
  return `/appointments/${appointmentId}/payment`;
}
