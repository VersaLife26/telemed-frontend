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
import type { Appointment } from "@/lib/consumer/api/types";
import { appointmentsListPath } from "@/lib/consumer/features/appointments";
import { formatVisitClock, formatVisitDate, statusLabel } from "@/lib/consumer/features/patient-appointment";
import { PageHero } from "@/components/consumer/ui/PageHero";
import { HEROES } from "@/lib/consumer/heroes";

type Tab = "upcoming" | "past";

function visitLabel(a: Appointment): string {
  return a.visit_patient_name || a.patient_name || a.counterpart_name || "Patient";
}

function isPast(a: Appointment): boolean {
  const s = (a.status || "").toLowerCase();
  return s === "completed" || s === "cancelled" || s === "no_show";
}

function isUpcoming(a: Appointment): boolean {
  const s = (a.status || "").toLowerCase();
  return s === "confirmed" || s === "pending_payment";
}

export default function DoctorAppointmentsPage() {
  const [items, setItems] = useState<Appointment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("upcoming");

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await browserApi<Appointment[]>(appointmentsListPath(100));
      setItems(Array.isArray(data) ? data : []);
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
      const ta = a.start_at || "";
      const tb = b.start_at || "";
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
          {filtered.map((a) => (
            <li key={a.id}>
              <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-h5 text-ink truncate">{visitLabel(a)}</p>
                    <StatusBadge status={a.status}>{statusLabel(a.status)}</StatusBadge>
                    {a.visit_patient_age != null && a.visit_patient_age > 0 ? (
                      <span className="text-caption text-muted">Age {a.visit_patient_age}</span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-body-sm text-muted tabular-time">
                    {formatVisitDate(a.start_at_local || a.start_at)} ·{" "}
                    {formatVisitClock(a.start_at_local || a.start_at)}
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
          ))}
        </ul>
      )}
    </div>
  );
}
