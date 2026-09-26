"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, FileText, Pill, StickyNote } from "lucide-react";

import { Alert } from "@/components/consumer/ui/Alert";
import { ButtonLink } from "@/components/consumer/ui/Button";
import { Card } from "@/components/consumer/ui/Card";
import { EmptyState } from "@/components/consumer/ui/EmptyState";
import { StatusBadge } from "@/components/consumer/ui/StatusBadge";
import { Tabs } from "@/components/consumer/ui/Tabs";
import { AppointmentsSkeleton } from "@/components/consumer/ui/skeletons";
import { browserApi } from "@/lib/consumer/api/client";
import type { Appointment, Paged } from "@/lib/consumer/api/types";
import { appointmentsListPath } from "@/lib/consumer/features/appointments";
import { formatVisitClock, formatVisitDate } from "@/lib/consumer/features/patient-appointment";
import { ageAtVisitDate } from "@/lib/consumer/features/visit-patient";
import { PageHero } from "@/components/consumer/ui/PageHero";
import { HEROES } from "@/lib/consumer/heroes";

type Tab = "upcoming" | "past";

function isPast(a: Appointment): boolean {
  return a.status === "completed" || a.status === "cancelled" || a.status === "noShow";
}

function isUpcoming(a: Appointment): boolean {
  return a.status === "confirmed" || a.status === "pendingPayment";
}

export default function DoctorAppointmentsPage() {
  const [items, setItems] = useState<Appointment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("upcoming");

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await browserApi<Paged<Appointment>>(appointmentsListPath(100));
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load visits");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const list = tab === "past" ? items.filter(isPast) : items.filter(isUpcoming);
    return [...list].sort((a, b) => {
      const ta = a.startAt;
      const tb = b.startAt;
      return tab === "past" ? tb.localeCompare(ta) : ta.localeCompare(tb);
    });
  }, [items, tab]);

  if (loading) return <AppointmentsSkeleton />;

  return (
    <div className="flex flex-col gap-8">
      <PageHero {...HEROES.calendar} title="Visits" lede="Upcoming and completed consultations with notes and prescriptions." />

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Tabs
        label="Visit list"
        value={tab}
        onChange={setTab}
        items={[
          { value: "upcoming", label: "Upcoming" },
          { value: "past", label: "Completed" },
        ]}
      />

      {filtered.length === 0 ? (
        <EmptyState
          title={tab === "past" ? "No completed visits yet" : "No upcoming visits"}
          body={
            tab === "past"
              ? "Finished consultations appear here with links to notes and prescriptions."
              : "Confirmed bookings show up here and on your calendar."
          }
          icon={<CalendarDays className="size-5" />}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((a) => {
            const age = a.visitPatient?.dateOfBirth ? ageAtVisitDate(a.visitPatient.dateOfBirth, a.startAt) : 0;
            return (
            <li key={a.id}>
              <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-h5 text-ink truncate">{a.visitPatient?.name || "Patient"}</p>
                    <StatusBadge status={a.status} />
                    {age > 0 ? <span className="text-caption text-muted">Age {age}</span> : null}
                  </div>
                  <p className="mt-1 text-body-sm text-muted tabular-time">
                    {formatVisitDate(a.startAt)} · {formatVisitClock(a.startAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tab === "upcoming" ? (
                    <ButtonLink href={`/workspace?call=${encodeURIComponent(a.id)}`} size="sm">
                      Join
                    </ButtonLink>
                  ) : (
                    <>
                      <ButtonLink
                        href={`/appointments/${a.id}/clinical-notes`}
                        size="sm"
                        variant="outline"
                        leading={<StickyNote className="size-4" />}
                      >
                        Notes
                      </ButtonLink>
                      <ButtonLink
                        href={`/appointments/${a.id}/prescription`}
                        size="sm"
                        variant="outline"
                        leading={<Pill className="size-4" />}
                      >
                        Prescription
                      </ButtonLink>
                      <ButtonLink
                        href={`/appointments/${a.id}/visit`}
                        size="sm"
                        variant="ghost"
                        leading={<FileText className="size-4" />}
                      >
                        Details
                      </ButtonLink>
                    </>
                  )}
                </div>
              </Card>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
