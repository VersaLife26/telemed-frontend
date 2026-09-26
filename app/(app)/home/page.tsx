import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Baby,
  BadgeCheck,
  Brain,
  CalendarDays,
  Eye,
  HeartPulse,
  Sparkles,
  Stethoscope,
  Video,
} from "lucide-react";

import { ButtonLink } from "@/components/consumer/ui/Button";
import { Card } from "@/components/consumer/ui/Card";
import { DoctorCard } from "@/components/consumer/ui/DoctorCard";
import { EmptyState } from "@/components/consumer/ui/EmptyState";
import { HeroChip, PageHero } from "@/components/consumer/ui/PageHero";
import { EmptyVisitTicket, VisitTicket } from "@/components/consumer/ui/VisitTicket";
import { StatusBadge } from "@/components/consumer/ui/StatusBadge";
import { apiFetch } from "@/lib/consumer/api/client";
import type { Appointment, Doctor, Paged, Specialty, TelemedUser } from "@/lib/consumer/api/types";
import { assets } from "@/lib/consumer/assets";
import { getAccessToken } from "@/lib/consumer/auth/cookies";
import { HEROES } from "@/lib/consumer/heroes";
import {
  appointmentAction,
  appointmentDoctorName,
  colomboHour,
  firstName,
  formatVisitClock,
  formatVisitDate,
  greetingForHour,
  pickNextAppointment,
  uniqueDoctorIds,
} from "@/lib/consumer/features/patient-appointment";
import { buildDoctorsApiQuery } from "@/lib/consumer/features/doctor-search";
import { profilePhotoSrc } from "@/lib/consumer/features/profile";

const SPECIALTY_TILES = [
  { code: "general_practice", label: "General practice", Icon: Stethoscope },
  { code: "pediatrics", label: "Pediatrics", Icon: Baby },
  { code: "cardiology", label: "Cardiology", Icon: HeartPulse },
  { code: "psychology", label: "Counselling", Icon: Brain },
  { code: "ophthalmology", label: "Eye care", Icon: Eye },
  { code: "dermatology", label: "Dermatology", Icon: Sparkles },
] as const;

function SectionHead({
  eyebrow,
  title,
  href,
  linkLabel,
}: {
  eyebrow: string;
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="text-eyebrow text-brand">{eyebrow}</p>
        <h2 className="mt-1.5 text-h3 text-ink">{title}</h2>
      </div>
      {href ? (
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-body-sm font-semibold text-brand underline-offset-4 can-hover:hover:underline"
        >
          {linkLabel}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      ) : null}
    </div>
  );
}

async function loadDoctors() {
  try {
    const page = await apiFetch<Paged<Doctor>>(`/api/v1/doctors?${buildDoctorsApiQuery({}, 6)}`);
    return { doctors: page.items, error: null as string | null };
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
    const page = await apiFetch<Paged<Appointment>>("/api/v1/appointments?pageSize=20", { token });
    return { appointments: page.items, error: null as string | null };
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
    return await apiFetch<TelemedUser>("/api/v1/me", { token });
  } catch {
    return null;
  }
}

async function loadVisitDoctors(appointments: Appointment[]) {
  const ids = uniqueDoctorIds(appointments);
  const entries = await Promise.all(
    ids.map(async (id) => {
      try {
        const doctor = await apiFetch<Doctor>(`/api/v1/doctors/${id}`);
        return [id, doctor] as const;
      } catch {
        return null;
      }
    }),
  );
  const byId: Record<string, Doctor> = {};
  const names: Record<string, string> = {};
  for (const entry of entries) {
    if (!entry) continue;
    byId[entry[0]] = entry[1];
    const display = entry[1].displayName?.trim();
    if (display) names[entry[0]] = display;
  }
  return { byId, names };
}

export default async function HomePage() {
  const token = await getAccessToken();
  const [{ doctors, error: doctorsError }, { appointments, error: appointmentsError }, me, specialties] =
    await Promise.all([
      loadDoctors(),
      loadAppointments(token),
      loadMe(token),
      apiFetch<Specialty[]>("/api/v1/specialties").catch(() => [] as Specialty[]),
    ]);

  const next = pickNextAppointment(appointments);
  const { byId: visitDoctors, names: doctorNames } = await loadVisitDoctors(appointments);
  const nextDoctor =
    (next ? visitDoctors[next.doctorId] : undefined) ||
    (next ? doctors.find((d) => d.id === next.doctorId) : undefined);
  const name = firstName(me?.fullName);
  const hello = greetingForHour(colomboHour());
  const later = appointments.filter((a) => a.id !== next?.id).slice(0, 4);

  return (
    <div className="flex flex-col gap-14">
      <div>
        <PageHero
          {...HEROES.home}
          eyebrow={`${hello}${name ? `, ${name}` : ""}`}
          chips={
            <>
              <HeroChip
                icon={<BadgeCheck className="size-5" />}
                value="SLMC verified"
                label="Every doctor checked"
              />
              <HeroChip
                icon={<Video className="size-5" />}
                value="Video consults"
                label="From home, on any device"
                className="ml-10"
              />
            </>
          }
          overlap={
            <div className="max-w-3xl">
              {next ? (
                <VisitTicket
                  appointment={next}
                  doctorName={appointmentDoctorName(next, doctorNames)}
                  doctorPhoto={profilePhotoSrc(nextDoctor?.photoUrl)}
                />
              ) : (
                <EmptyVisitTicket />
              )}
            </div>
          }
        />
      </div>

      {appointmentsError ? (
        <p className="text-body-sm text-danger">Couldn’t load visits: {appointmentsError}</p>
      ) : null}

      <section className="flex flex-col gap-6">
        <SectionHead eyebrow="Our specialties" title="Care for your whole family" />
        <ul className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {SPECIALTY_TILES.map(({ code, label, Icon }) => (
            <li key={code}>
              <Link
                href={`/doctors?specialty=${code}`}
                className="group flex h-full flex-col items-center gap-3 rounded-lg border border-border-subtle bg-surface px-3 py-6 text-center shadow-sm transition-[transform,box-shadow,background-color,border-color] duration-[200ms] ease-out active:scale-[0.98] can-hover:hover:-translate-y-1 can-hover:hover:border-brand can-hover:hover:bg-brand can-hover:hover:shadow-brand"
              >
                <Icon
                  aria-hidden="true"
                  className="size-9 text-brand transition-colors duration-[200ms] can-hover:group-hover:text-on-brand"
                  strokeWidth={1.4}
                />
                <span className="text-label text-ink transition-colors duration-[200ms] can-hover:group-hover:text-on-brand">
                  {label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-6">
        <SectionHead
          eyebrow="Meet our"
          title="Featured doctors"
          href="/doctors"
          linkLabel="Browse all"
        />

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
              <DoctorCard key={d.id} doctor={d} specialties={specialties} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-6">
        <SectionHead
          eyebrow="Coming up"
          title="Later visits"
          href="/appointments"
          linkLabel="View all"
        />

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
              const when = a.startAt;
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
                      {appointmentDoctorName(a, doctorNames)}
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

      <section className="relative isolate overflow-hidden rounded-xl bg-[image:var(--gradient-cta)] text-on-brand shadow-brand">
        <div aria-hidden="true" className="hero-pattern opacity-25" />
        <div className="grid items-end gap-6 md:grid-cols-[1fr_260px]">
          <div className="p-8 md:p-10">
            <h2 className="text-h2">Don’t let your health take a backseat</h2>
            <p className="mt-3 max-w-md text-body-lg text-white/85">
              Book a video consult with one of our experienced doctors today.
            </p>
            <ButtonLink href="/doctors" variant="outline" size="lg" className="mt-6 border-transparent text-brand">
              Find a doctor
              <ArrowRight aria-hidden="true" className="size-4" />
            </ButtonLink>
          </div>
          <div className="relative hidden h-64 md:block">
            <Image
              src={assets.hero.homeCta}
              alt=""
              fill
              sizes="260px"
              unoptimized
              className="object-contain object-bottom drop-shadow-xl"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
