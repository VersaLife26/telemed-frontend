import type { Appointment } from "@/lib/consumer/api/types";

export function appointmentsListPath(perPage = 50): string {
  return `/appointments?per_page=${perPage}`;
}

export function appointmentReschedulePath(appointmentId: string): string {
  return `/appointments/${appointmentId}/reschedule-requests`;
}

export function isConfirmedAppointment(appointment: Pick<Appointment, "status">): boolean {
  return appointment.status === "confirmed";
}
