import Link from "next/link";
import { Card } from "@/components/consumer/ui/Card";
import { DoctorCard } from "@/components/consumer/ui/DoctorCard";
import { EmptyState } from "@/components/consumer/ui/EmptyState";
import { EmptyVisitTicket, VisitTicket } from "@/components/consumer/ui/VisitTicket";
import { StatusBadge } from "@/components/consumer/ui/StatusBadge";
import { apiFetch } from "@/lib/consumer/api/client";
import type { Appointment, Doctor, TelemedUser } from "@/lib/consumer/api/types";
import { getAccessToken } from "@/lib/consumer/auth/cookies";
import {
  appointmentAction,
  colomboHour,
  firstName,
  formatVisitClock,
  formatVisitDate,
  greetingForHour,
  pickNextAppointment,
} from "@/lib/consumer/features/patient-appointment";

async function loadDoctors() {
  try {
    const doctors = await apiFetch<Doctor[]>("/api/v1/doctors?per_page=6&sort=rating");
    return { doctors: Array.isArray(doctors) ? doctors : [], error: null as string | null };
  } catch (e) {
    return {
      doctors: [] as Doctor[],
      error: e instanceof Error ? e.message : "Could not load doctors",
    };
  }
}

async function loadAppointments(token: string | undefined) {
  if (!token) return { appointments: [] as Appointment[], error: null as string | null };
  try {
    const data = await apiFetch<Appointment[]>("/api/v1/appointments?per_page=5", { token });
    return { appointments: Array.isArray(data) ? data : [], error: null as string | null };
  } catch (e) {
    return {
      appointments: [] as Appointment[],
      error: e instanceof Error ? e.message : "Could not load visits",
    };
  }
}

async function loadMe(token: string | undefined) {
  if (!token) return null;
  try {
    return await apiFetch<TelemedUser>("/api/v1/users/me", { token });
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const token = await getAccessToken();
  const [{ doctors, error: doctorsError }, { appointments, error: appointmentsError }, me] =
    await Promise.all([loadDoctors(), loadAppointments(token), loadMe(token)]);

  const next = pickNextAppointment(appointments);
  const doctorName = next?.doctor_id
    ? doctors.find((d) => d.id === next.doctor_id)?.display_name
    : null;
  const name = firstName(me?.name);
  const hello = greetingForHour(colomboHour());
  const later = appointments.filter((a) => a.id !== next?.id).slice(0, 4);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-h3 text-ink sm:text-h2">
          {hello}
          {name ? `, ${name}` : ""}
        </h1>
        <p className="text-body text-text-muted">
          {next ? "Your next consult is ready when you are." : "Book a video consult when you need care."}
        </p>
      </header>

      {next ? <VisitTicket appointment={next} doctorName={doctorName} /> : <EmptyVisitTicket />}

      {appointmentsError ? (
        <p className="text-body-sm text-danger">Couldn’t load visits: {appointmentsError}</p>
      ) : null}

      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-h5 text-ink">Doctors</h2>
          <Link href="/doctors" className="text-body-sm font-medium text-primary">
            Browse all
          </Link>
        </div>
        {doctorsError ? (
          <EmptyState
            title="Couldn’t load doctors"
            body={doctorsError}
            action={{ href: "/doctors", label: "Try the directory" }}
          />
        ) : doctors.length === 0 ? (
          <EmptyState
            title="No doctors listed yet"
            body="Approved clinicians will appear here once the directory is live."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {doctors.map((d) => (
              <DoctorCard key={d.id} doctor={d} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-h5 text-ink">Later visits</h2>
          <Link href="/appointments" className="text-body-sm font-medium text-primary">
            View all
          </Link>
        </div>
        {!token ? (
          <EmptyState
            title="Sign in to see visits"
            body="Your bookings stay on this device after you sign in with email or OTP."
            action={{ href: "/login", label: "Sign in" }}
          />
        ) : later.length === 0 && !next ? (
          <EmptyState
            title="No visits yet"
            body="When you book a consult, it will show up here with a way to pay or join."
            action={{ href: "/doctors", label: "Find a doctor" }}
          />
        ) : later.length === 0 ? (
          <p className="text-body-sm text-text-muted">No other visits on the list.</p>
        ) : (
          <ul className="grid gap-3">
            {later.map((a) => {
              const action = appointmentAction(a.id, a.status);
              const when = a.start_at_local || a.start_at;
              const inner = (
                <>
                  <div className="min-w-0">
                    <p className="truncate text-body font-medium text-ink">
                      {a.specialty || "Consultation"}
                    </p>
                    <p className="mt-1 text-body-sm text-text-muted">
                      {formatVisitDate(when)} · {formatVisitClock(when)}
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                </>
              );
              return (
                <li key={a.id}>
                  {action ? (
                    <Link
                      href={action.href}
                      className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border bg-paper px-5 py-4 shadow-[var(--shadow-soft)]"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <Card className="flex items-center justify-between gap-3 px-5 py-4">{inner}</Card>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
