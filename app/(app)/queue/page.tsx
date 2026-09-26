import { CalendarDays, FileText, ListOrdered, Pill, User, Video } from "lucide-react";

import { EndConsultationButton } from "@/components/consumer/end-consultation-button";
import { RescheduleRequestForm } from "@/components/consumer/reschedule-request-form";
import { Alert } from "@/components/consumer/ui/Alert";
import { ButtonLink } from "@/components/consumer/ui/Button";
import { Card } from "@/components/consumer/ui/Card";
import { EmptyState } from "@/components/consumer/ui/EmptyState";
import { StatusBadge } from "@/components/consumer/ui/StatusBadge";
import { apiFetch } from "@/lib/consumer/api/client";
import type { Appointment, Paged, RescheduleRequest } from "@/lib/consumer/api/types";
import { getAccessToken } from "@/lib/consumer/auth/cookies";
import { afterEndPath } from "@/lib/consumer/features/consult";
import { formatVisitClock, formatVisitDate } from "@/lib/consumer/features/patient-appointment";
import { formatMoney } from "@/lib/consumer/money";
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
        const pending = items.find((r) => r.status === "pending") ?? null;
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
    const data = await apiFetch<Paged<Appointment>>(
      "/api/v1/appointments?pageSize=50&status=confirmed",
      { token },
    );
    appointments = data.items;
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
      />

      {error ? (
        <Alert tone="danger" title="Couldn’t load the queue">
          {error}
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
            const when = a.startAt;
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
                    <User className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-body font-semibold text-ink">
                        {a.visitPatient?.name || "Patient"}
                      </p>
                      <StatusBadge status={a.status} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-muted">
                      <span className="tabular-time">
                        {formatVisitDate(when)} · {formatVisitClock(when)}
                      </span>
                      {a.feeCents > 0 ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-medium text-ink">
                            {formatMoney(a.feeCents, a.currency || "LKR")}
                          </span>
                        </>
                      ) : null}
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-caption text-muted">
                        Ref: {a.id.slice(0, 8)}
                      </span>
                    </div>

                    {a.intake?.symptoms ? (
                      <div className="mt-2.5 rounded-lg border border-line bg-surface-subtle p-3 text-body-sm">
                        <span className="font-medium text-ink">Reason for visit: </span>
                        <span className="text-muted">{a.intake.symptoms}</span>
                      </div>
                    ) : null}
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
                      Prescription
                    </ButtonLink>
                    <EndConsultationButton appointmentId={a.id} />
                  </div>
                  <RescheduleRequestForm
                    appointmentId={a.id}
                    pending={pending[a.id] ?? null}
                    startAt={a.startAt}
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
