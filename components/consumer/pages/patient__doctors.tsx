import Link from "next/link";
import { Search, Stethoscope } from "lucide-react";

import { Button } from "@/components/consumer/ui/Button";
import { DoctorCard } from "@/components/consumer/ui/DoctorCard";
import { EmptyState } from "@/components/consumer/ui/EmptyState";
import { Input } from "@/components/consumer/ui/Input";
import { Select } from "@/components/consumer/ui/Select";
import { apiFetch } from "@/lib/consumer/api/client";
import type { Doctor } from "@/lib/consumer/api/types";
import { SPECIALTIES } from "@/lib/consumer/features/doctor-apply";
import {
  buildDoctorsApiQuery,
  hasActiveDoctorFilters,
  type DoctorListFilters,
} from "@/lib/consumer/features/doctor-search";

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
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-h2 text-ink">Doctors</h1>
        <p className="mt-1 text-body-lg text-muted">
          Search by name or specialty, then pick a slot.
        </p>
      </header>

      {/* A plain GET form: the directory has to be searchable before, and
          without, JavaScript. The panel is glass because it sits on the page
          wash rather than on a white card. */}
      <form className="glass-panel flex flex-col gap-4 p-5 md:p-6" role="search">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            id="doctor-search"
            name="q"
            defaultValue={filters.q || ""}
            placeholder="Search by name"
            aria-label="Search by name"
            icon={<Search className="size-4" />}
            className="flex-1"
          />
          <Button type="submit" size="lg" className="sm:min-w-32">
            Search
          </Button>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <Select
            id="filter-specialty"
            name="specialty"
            label="Specialty"
            defaultValue={filters.specialty || ""}
          >
            <option value="">All specialties</option>
            {SPECIALTIES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label}
              </option>
            ))}
          </Select>

          <Input
            id="filter-min-fee"
            name="min_fee"
            label="Min fee (LKR)"
            type="number"
            inputMode="decimal"
            min={0}
            step={100}
            defaultValue={filters.min_fee || ""}
            placeholder="e.g. 2000"
          />

          <Input
            id="filter-max-fee"
            name="max_fee"
            label="Max fee (LKR)"
            type="number"
            inputMode="decimal"
            min={0}
            step={100}
            defaultValue={filters.max_fee || ""}
            placeholder="e.g. 6000"
          />
        </div>

        {filtered ? (
          <p className="text-body-sm text-muted">
            <Link
              href="/doctors"
              className="font-semibold text-brand underline-offset-4 can-hover:hover:underline"
            >
              Clear filters
            </Link>
          </p>
        ) : null}
      </form>

      {error ? (
        <EmptyState
          title="Couldn’t load doctors"
          body={error}
          icon={<Stethoscope className="size-5" />}
          action={{ href: "/doctors", label: "Try again" }}
        />
      ) : doctors.length === 0 ? (
        <EmptyState
          title="No doctors found"
          body={emptyBody}
          icon={<Stethoscope className="size-5" />}
        />
      ) : (
        <div className="stagger grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {doctors.map((d) => (
            <DoctorCard key={d.id} doctor={d} />
          ))}
        </div>
      )}
    </div>
  );
}
