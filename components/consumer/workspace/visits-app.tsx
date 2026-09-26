"use client";

import { useEffect, useMemo, useState } from "react";
import { Pill, Search, StickyNote, UserRound, Video } from "lucide-react";

import { Alert } from "@/components/consumer/ui/Alert";
import { StatusBadge } from "@/components/consumer/ui/StatusBadge";
import { browserApi } from "@/lib/consumer/api/client";
import type { Appointment, Paged } from "@/lib/consumer/api/types";
import { appointmentsListPath } from "@/lib/consumer/features/appointments";
import { colomboDayKey } from "@/lib/consumer/features/calendar";
import { formatVisitClock, formatVisitDate } from "@/lib/consumer/features/patient-appointment";
import { ageAtVisitDate } from "@/lib/consumer/features/visit-patient";
import { cx } from "@/lib/consumer/cx";

type Tab = "today" | "upcoming" | "past";

const PAGE = 20;

function visitLabel(a: Appointment): string {
  return a.visitPatient?.name || "Patient";
}

function bucket(a: Appointment, today: string): Tab {
  if (a.status === "completed" || a.status === "cancelled" || a.status === "noShow") return "past";
  return colomboDayKey(a.startAt) === today ? "today" : "upcoming";
}

export function VisitsApp({
  onOpen,
  onJoin,
}: {
  onOpen: (appointment: Appointment, app: "patient" | "notes" | "rx") => void;
  onJoin: (appointmentId: string) => void;
}) {
  const [items, setItems] = useState<Appointment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("today");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const today = colomboDayKey(new Date());

  useEffect(() => {
    let cancelled = false;
    browserApi<Paged<Appointment>>(appointmentsListPath(100))
      .then((data) => {
        if (!cancelled) setItems(data.items);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load visits");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((a) => bucket(a, today) === tab)
      .filter((a) => !q || visitLabel(a).toLowerCase().includes(q))
      .sort((a, b) => {
        const ta = a.startAt;
        const tb = b.startAt;
        return tab === "past" ? tb.localeCompare(ta) : ta.localeCompare(tb);
      });
  }, [items, query, tab, today]);

  useEffect(() => setLimit(PAGE), [tab, query]);

  const counts = useMemo(() => {
    const c = { today: 0, upcoming: 0, past: 0 };
    for (const a of items) c[bucket(a, today)] += 1;
    return c;
  }, [items, today]);

  return (
    <div className="@container flex h-full min-h-0 flex-col text-white">
      <div className="flex shrink-0 flex-col gap-2 border-b border-white/10 p-3 @lg:flex-row @lg:items-center">
        <div role="tablist" aria-label="Visits" className="flex rounded-md bg-white/10 p-0.5">
          {(["today", "upcoming", "past"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cx(
                "flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-[8px] px-3 text-body-sm font-semibold capitalize",
                "transition-[background-color,color,scale] duration-[160ms] ease-out active:scale-[0.97]",
                tab === t ? "bg-white text-ink shadow-sm" : "text-white/70 can-hover:hover:text-white",
              )}
            >
              {t === "past" ? "Previous" : t}
              <span className={cx("text-caption tabular-time", tab === t ? "text-muted" : "text-white/50")}>
                {counts[t]}
              </span>
            </button>
          ))}
        </div>
        <label className="relative flex-1">
          <span className="sr-only">Search patients</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/50" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search patients"
            className="min-h-10 w-full rounded-md border border-white/15 bg-white/10 pl-9 pr-3 text-body-sm text-white outline-none transition-[border-color,box-shadow] duration-[160ms] ease-out placeholder:text-white/40 focus:border-white/40"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {loading ? (
          <ul className="flex flex-col gap-2" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="h-16 animate-pulse rounded-lg bg-white/5" />
            ))}
          </ul>
        ) : filtered.length === 0 ? (
          <p className="px-1 py-6 text-center text-body-sm text-white/60">
            {query
              ? "No visits match that name."
              : tab === "past"
                ? "Completed visits appear here with their notes and prescriptions."
                : tab === "today"
                  ? "No visits today."
                  : "No upcoming visits."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {filtered.slice(0, limit).map((a) => {
              const age = a.visitPatient?.dateOfBirth ? ageAtVisitDate(a.visitPatient.dateOfBirth, a.startAt) : 0;
              return (
              <li
                key={a.id}
                className="flex flex-col gap-3 rounded-lg bg-white/[0.06] p-3 ring-1 ring-white/10 @xl:flex-row @xl:items-center"
              >
                <button
                  type="button"
                  onClick={() => onOpen(a, "patient")}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10">
                    <UserRound className="size-5 text-white/80" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-label">{visitLabel(a)}</span>
                      <StatusBadge status={a.status} />
                    </span>
                    <span className="mt-0.5 block text-caption text-white/60 tabular-time">
                      {formatVisitDate(a.startAt)} · {formatVisitClock(a.startAt)}
                      {age > 0 ? ` · Age ${age}` : ""}
                    </span>
                  </span>
                </button>
                <div className="flex flex-wrap gap-1.5">
                  {tab !== "past" && a.status === "confirmed" ? (
                    <RowButton primary onClick={() => onJoin(a.id)} icon={<Video className="size-4" />}>
                      Join
                    </RowButton>
                  ) : null}
                  <RowButton onClick={() => onOpen(a, "notes")} icon={<StickyNote className="size-4" />}>
                    Notes
                  </RowButton>
                  <RowButton onClick={() => onOpen(a, "rx")} icon={<Pill className="size-4" />}>
                    Prescription
                  </RowButton>
                </div>
              </li>
              );
            })}
          </ul>
        )}
        {filtered.length > limit ? (
          <button
            type="button"
            onClick={() => setLimit((n) => n + PAGE)}
            className="mt-3 min-h-10 w-full rounded-md bg-white/10 text-body-sm font-semibold transition-[background-color,scale] duration-[160ms] ease-out active:scale-[0.98] can-hover:hover:bg-white/15"
          >
            Show more ({filtered.length - limit})
          </button>
        ) : null}
      </div>
    </div>
  );
}

function RowButton({
  primary,
  icon,
  onClick,
  children,
}: {
  primary?: boolean;
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex min-h-9 items-center gap-1.5 rounded-pill px-3 text-body-sm font-semibold",
        "transition-[background-color,scale] duration-[140ms] ease-out active:scale-[0.96]",
        primary ? "bg-brand text-white can-hover:hover:bg-brand-hover" : "bg-white/10 can-hover:hover:bg-white/20",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
