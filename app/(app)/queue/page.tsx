import { CalendarDays, FileText, ListOrdered, Pill, Video } from "lucide-react";

import { ReadyForNextButton } from "@/components/consumer/ready-for-next-button";
import { RescheduleRequestForm } from "@/components/consumer/reschedule-request-form";
import { Alert } from "@/components/consumer/ui/Alert";
import { ButtonLink } from "@/components/consumer/ui/Button";
import { Card } from "@/components/consumer/ui/Card";
import { EmptyState } from "@/components/consumer/ui/EmptyState";
import { StatusBadge } from "@/components/consumer/ui/StatusBadge";
import { apiFetch } from "@/lib/consumer/api/client";
import type { Appointment, RescheduleRequest } from "@/lib/consumer/api/types";
import { getAccessToken } from "@/lib/consumer/auth/cookies";
import { afterEndPath } from "@/lib/consumer/features/consult";
import { formatVisitClock, formatVisitDate } from "@/lib/consumer/features/patient-appointment";
import { prescriptionPagePath } from "@/lib/consumer/features/prescription";
import { HeroChip, PageHero } from "@/components/consumer/ui/PageHero";
import { HEROES } from "@/lib/consumer/heroes";

async function pendingByAppointment(
  token: string,
  appointments: Appointment[],
): Promise<Record<string, RescheduleRequest | null>> {
  const entries = await Promise.all(
    appointments.map(async (a) => {
      try {
        const items = await apiFetch<RescheduleRequest[]>(
          `/api/v1/appointments/${a.id}/reschedule-requests`,
          { token },
        );
        const pending =
          (Array.isArray(items) ? items : []).find((r) => r.status === "pending") ?? null;
        return [a.id, pending] as const;
      } catch {
        return [a.id, null] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}

export default async function QueuePage() {
  const token = await getAccessToken();
  if (!token) {
    return (
      <Card className="flex max-w-xl flex-col items-start gap-4">
        <p className="text-body text-muted">Sign in to load your consultation queue.</p>
        <ButtonLink href="/login">Sign in</ButtonLink>
      </Card>
    );
  }

  let appointments: Appointment[] = [];
  let pending: Record<string, RescheduleRequest | null> = {};
  let error: string | null = null;
  try {
    const data = await apiFetch<Appointment[]>(
      "/api/v1/appointments?per_page=50&status=confirmed",
      { token },
    );
    appointments = Array.isArray(data) ? data : [];
    pending = await pendingByAppointment(token, appointments);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load queue";
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHero
        {...HEROES.queue}
        chips={
          error ? undefined : (
            <HeroChip
              icon={<ListOrdered className="size-5" />}
              value={appointments.length}
              label={appointments.length === 1 ? "Confirmed consult" : "Confirmed consults"}
            />
          )
        }
        overlap={
          <Card className="flex flex-col items-start gap-3 shadow-lg">
            <h2 className="text-h5 text-ink">Finished early?</h2>
            <p className="max-w-prose text-body-sm text-muted">
              After you end a call you can ask only the next patient whether they can join now.
              Later slots stay where they are.
            </p>
            <ReadyForNextButton />
          </Card>
        }
      />

      {error ? (
        <Alert tone="danger" title="Couldn’t load the queue">
          {error} Doctor appointment lists need a JWT carrying <code>telemed_doctor_id</code>; if
          you see a claim error, that claim may be missing on this account.
        </Alert>
      ) : null}

      {!error && appointments.length === 0 ? (
        <EmptyState
          title="Nothing in the queue"
          body="Confirmed appointments appear here on the day, with a way to join, write notes and issue a prescription."
          icon={<CalendarDays className="size-5" />}
        />
      ) : (
        <ul className="stagger flex flex-col gap-3">
          {appointments.map((a) => {
            const when = a.start_at_local || a.start_at;
            return (
              <Card
                as="li"
                key={a.id}
                className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
              >
                <div className="flex min-w-0 gap-4">
                  <span
                    aria-hidden="true"
                    className="hidden size-11 shrink-0 items-center justify-center rounded-full bg-tint text-brand sm:flex"
                  >
                    <CalendarDays className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-body font-semibold text-ink">
                        {a.counterpart_name || a.patient_name || a.specialty || "Consultation"}
                      </p>
                      <StatusBadge status={a.status} />
                    </div>
                    <p className="mt-1 text-body-sm text-muted tabular-time">
                      {formatVisitDate(when)} · {formatVisitClock(when)}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-stretch gap-3 lg:items-end">
                  <div className="flex flex-wrap gap-2">
                    <ButtonLink
                      href={`/workspace?call=${a.id}`}
                      size="sm"
                      leading={<Video className="size-4" />}
                    >
                      Join call
                    </ButtonLink>
                    <ButtonLink
                      href={afterEndPath("doctor", a.id)}
                      size="sm"
                      variant="secondary"
                      leading={<FileText className="size-4" />}
                    >
                      Notes
                    </ButtonLink>
                    <ButtonLink
                      href={prescriptionPagePath(a.id)}
                      size="sm"
                      variant="secondary"
                      leading={<Pill className="size-4" />}
                    >
                      Rx
                    </ButtonLink>
                  </div>
                  <RescheduleRequestForm
                    appointmentId={a.id}
                    pending={pending[a.id] ?? null}
                    startAt={a.start_at}
                  />
                </div>
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
}
