import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, Stethoscope } from "lucide-react";

import { Card } from "@/components/consumer/ui/Card";
import { DoctorCard } from "@/components/consumer/ui/DoctorCard";
import { EmptyState } from "@/components/consumer/ui/EmptyState";
import { EmptyVisitTicket, VisitTicket } from "@/components/consumer/ui/VisitTicket";
import { StatusBadge } from "@/components/consumer/ui/StatusBadge";
import { apiFetch } from "@/lib/consumer/api/client";
import type { Appointment, Doctor, TelemedUser } from "@/lib/consumer/api/types";
import { stock } from "@/lib/consumer/assets";
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
import { profilePhotoSrc } from "@/lib/consumer/features/profile";

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
  const nextDoctor = next?.doctor_id ? doctors.find((d) => d.id === next.doctor_id) : undefined;
  const name = firstName(me?.name);
  const hello = greetingForHour(colomboHour());
  const later = appointments.filter((a) => a.id !== next?.id).slice(0, 4);

  return (
    <div className="flex flex-col gap-12">
      {/* Hero band. The ticket sits on the gradient rather than on the page,
          which is what gives the most important thing on the screen its own
          plane instead of making it one more card in a stack. */}
      <section className="relative overflow-hidden rounded-xl bg-[image:var(--gradient-hero)] p-6 md:p-8">
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="min-w-0">
            <p className="text-body text-blue-800">
              {hello}
              {name ? `, ${name}` : ""}
            </p>
            <h1 className="mt-1 text-h2 text-ink">
              {next ? "Your next visit" : "Book a video consult"}
            </h1>
            <div className="mt-6">
              {next ? (
                <VisitTicket
                  appointment={next}
                  doctorName={nextDoctor?.display_name}
                  doctorPhoto={profilePhotoSrc(nextDoctor?.photo_url)}
                />
              ) : (
                <EmptyVisitTicket />
              )}
            </div>
          </div>

          <Image
            src={stock.patientHero}
            alt=""
            width={520}
            height={640}
            unoptimized
            className="hidden h-full max-h-80 w-full rounded-lg object-cover shadow-lg lg:block"
          />
        </div>
      </section>

      {appointmentsError ? (
        <p className="text-body-sm text-danger">Couldn’t load visits: {appointmentsError}</p>
      ) : null}

      <section className="flex flex-col gap-5">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-h3 text-ink">Featured doctors</h2>
          <Link
            href="/doctors"
            className="inline-flex items-center gap-1 text-body-sm font-semibold text-brand underline-offset-4 can-hover:hover:underline"
          >
            Browse all
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>

        {doctorsError ? (
          <EmptyState
            title="Couldn’t load doctors"
            body={doctorsError}
            icon={<Stethoscope className="size-5" />}
            action={{ href: "/doctors", label: "Try the directory" }}
          />
        ) : doctors.length === 0 ? (
          <EmptyState
            title="No doctors listed yet"
            body="Approved clinicians will appear here once the directory is live."
            icon={<Stethoscope className="size-5" />}
          />
        ) : (
          <div className="stagger grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {doctors.map((d) => (
              <DoctorCard key={d.id} doctor={d} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-5">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-h3 text-ink">Later visits</h2>
          <Link
            href="/appointments"
            className="inline-flex items-center gap-1 text-body-sm font-semibold text-brand underline-offset-4 can-hover:hover:underline"
          >
            View all
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>

        {!token ? (
          <EmptyState
            title="Sign in to see visits"
            body="Your bookings stay on this device after you sign in with email or OTP."
            icon={<CalendarDays className="size-5" />}
            action={{ href: "/login", label: "Sign in" }}
          />
        ) : later.length === 0 && !next ? (
          <EmptyState
            title="No visits yet"
            body="When you book a consult, it will show up here with a way to pay or join."
            icon={<CalendarDays className="size-5" />}
            action={{ href: "/doctors", label: "Find a doctor" }}
          />
        ) : later.length === 0 ? (
          <p className="text-body-sm text-muted">No other visits on the list.</p>
        ) : (
          <ul className="stagger grid gap-3">
            {later.map((a) => {
              const action = appointmentAction(a.id, a.status);
              const when = a.start_at_local || a.start_at;
              const inner = (
                <>
                  <span
                    aria-hidden="true"
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-tint text-brand"
                  >
                    <CalendarDays className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body font-semibold text-ink">
                      {a.specialty || "Consultation"}
                    </p>
                    <p className="mt-0.5 text-body-sm text-muted tabular-time">
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
                      className="flex items-center gap-4 rounded-lg border border-border-subtle bg-surface px-5 py-4 shadow-sm transition-[transform,box-shadow] duration-[200ms] ease-out can-hover:hover:-translate-y-0.5 can-hover:hover:shadow-md"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <Card className="flex items-center gap-4 px-5 py-4">{inner}</Card>
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
