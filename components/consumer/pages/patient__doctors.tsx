import Link from "next/link";

import { DoctorCard } from "@/components/consumer/ui/DoctorCard";
import { EmptyState } from "@/components/consumer/ui/EmptyState";
import { Button } from "@/components/consumer/ui/Button";
import { Input } from "@/components/consumer/ui/Input";
import { apiFetch } from "@/lib/consumer/api/client";
import type { Doctor } from "@/lib/consumer/api/types";
import { SPECIALTIES } from "@/lib/consumer/features/doctor-apply";
import {
  buildDoctorsApiQuery,
  hasActiveDoctorFilters,
  type DoctorListFilters,
} from "@/lib/consumer/features/doctor-search";

const filterFieldClass =
  "min-h-12 w-full rounded-[32px] border border-transparent bg-paper px-6 py-3 text-[16px] leading-[1.4] text-ink shadow-[var(--shadow-soft)] outline-none placeholder:text-text-placeholder";

export default async function DoctorsPage({
  searchParams,
}: {
  searchParams: Promise<DoctorListFilters>;
}) {
  const params = await searchParams;
  const filters: DoctorListFilters = {
    q: params.q,
    specialty: params.specialty,
    min_fee: params.min_fee,
    max_fee: params.max_fee,
  };
  const filtered = hasActiveDoctorFilters(filters);

  let doctors: Doctor[] = [];
  let error: string | null = null;
  try {
    const data = await apiFetch<Doctor[]>(`/api/v1/doctors?${buildDoctorsApiQuery(filters)}`);
    doctors = Array.isArray(data) ? data : [];
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load doctors";
  }

  const emptyBody = filtered
    ? "Nothing matched these filters. Try another specialty or a wider fee range."
    : "Approved clinicians will appear here once the directory is live.";

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-h3 text-ink">Doctors</h1>
        <p className="mt-1 text-body text-text-muted">Search by name or specialty, then pick a slot.</p>
      </header>

      <form className="flex flex-col gap-3" role="search">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="doctor-search">
            Search by name
          </label>
          <Input
            id="doctor-search"
            name="q"
            defaultValue={filters.q || ""}
            placeholder="Search by name"
            className="flex-1"
          />
          <Button type="submit" className="min-h-12 sm:min-w-32">
            Search
          </Button>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row">
          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="px-2 text-body-sm text-text-muted">Specialty</span>
            <select
              name="specialty"
              defaultValue={filters.specialty || ""}
              className={`${filterFieldClass} appearance-none`}
            >
              <option value="">All specialties</option>
              {SPECIALTIES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="px-2 text-body-sm text-text-muted">Min fee (LKR)</span>
            <Input
              name="min_fee"
              type="number"
              inputMode="decimal"
              min={0}
              step={100}
              defaultValue={filters.min_fee || ""}
              placeholder="e.g. 2000"
            />
          </label>

          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="px-2 text-body-sm text-text-muted">Max fee (LKR)</span>
            <Input
              name="max_fee"
              type="number"
              inputMode="decimal"
              min={0}
              step={100}
              defaultValue={filters.max_fee || ""}
              placeholder="e.g. 6000"
            />
          </label>
        </div>

        {filtered ? (
          <p className="px-2 text-body-sm text-text-muted">
            <Link href="/doctors" className="font-semibold text-primary underline-offset-2 hover:underline">
              Clear filters
            </Link>
          </p>
        ) : null}
      </form>

      {error ? (
        <EmptyState title="Couldn’t load doctors" body={error} action={{ href: "/doctors", label: "Try again" }} />
      ) : null}

      {!error && doctors.length === 0 ? (
        <EmptyState title="No doctors found" body={emptyBody} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {doctors.map((d) => (
          <DoctorCard key={d.id} doctor={d} />
        ))}
      </div>
    </div>
  );
}
