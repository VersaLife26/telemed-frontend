import type { Appointment } from "@/lib/consumer/api/types";

/** The caller's bookings, newest start first. `pageSize` is capped at 100 by the API. */
export function appointmentsListPath(pageSize = 50): string {
  return `/appointments?pageSize=${pageSize}`;
}

export function appointmentReschedulePath(appointmentId: string): string {
  return `/appointments/${appointmentId}/reschedule-requests`;
}

export function isConfirmedAppointment(appointment: Pick<Appointment, "status">): boolean {
  return appointment.status === "confirmed";
}
