import Link from "next/link";
import { BadgeCheck, Search, Stethoscope, Video, Wallet } from "lucide-react";

import { Button } from "@/components/consumer/ui/Button";
import { DoctorCard } from "@/components/consumer/ui/DoctorCard";
import { EmptyState } from "@/components/consumer/ui/EmptyState";
import { Input } from "@/components/consumer/ui/Input";
import { HeroChip, PageHero } from "@/components/consumer/ui/PageHero";
import { Select } from "@/components/consumer/ui/Select";
import { apiFetch } from "@/lib/consumer/api/client";
import type { Doctor } from "@/lib/consumer/api/types";
import { SPECIALTIES } from "@/lib/consumer/features/doctor-apply";
import {
  buildDoctorsApiQuery,
  hasActiveDoctorFilters,
  type DoctorListFilters,
} from "@/lib/consumer/features/doctor-search";
import { HEROES } from "@/lib/consumer/heroes";

function FieldIcon({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="mb-0.5 hidden size-10 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand shadow-brand lg:flex"
    >
      {children}
    </span>
  );
}

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
    <div className="flex flex-col gap-10">
      <div>
        <PageHero
          {...HEROES.doctors}
          chips={
            <>
              <HeroChip
                icon={<BadgeCheck className="size-5" />}
                value="SLMC registered"
                label="Verified before listing"
              />
              <HeroChip
                icon={<Video className="size-5" />}
                value="Video consults"
                label="Book in a few taps"
                className="ml-10"
              />
            </>
          }
          overlap={
            /* A plain GET form: the directory has to be searchable before,
               and without, JavaScript. Styled as the kit's booking bar that
               straddles the hero edge. */
            <form
              role="search"
              className="flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-lg md:p-6"
            >
              <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr_1.3fr_auto] md:grid-cols-2 md:items-end">
                <div className="flex items-end gap-3">
                  <FieldIcon>
                    <Search className="size-5" />
                  </FieldIcon>
                  <Input
                    id="doctor-search"
                    name="q"
                    label="Doctor"
                    defaultValue={filters.q || ""}
                    placeholder="Search by name"
                    fieldClassName="flex-1"
                  />
                </div>

                <div className="flex items-end gap-3">
                  <FieldIcon>
                    <Stethoscope className="size-5" />
                  </FieldIcon>
                  <Select
                    id="filter-specialty"
                    name="specialty"
                    label="Specialty"
                    defaultValue={filters.specialty || ""}
                    fieldClassName="min-w-0 flex-1"
                  >
                    <option value="">All specialties</option>
                    {SPECIALTIES.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="flex items-end gap-3">
                  <FieldIcon>
                    <Wallet className="size-5" />
                  </FieldIcon>
                  <Input
                    id="filter-min-fee"
                    name="min_fee"
                    label="Min fee (LKR)"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={100}
                    defaultValue={filters.min_fee || ""}
                    placeholder="2000"
                    fieldClassName="min-w-0 flex-1"
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
                    placeholder="6000"
                    fieldClassName="min-w-0 flex-1"
                  />
                </div>

                <Button type="submit">
                  Search
                </Button>
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
          }
        />
      </div>

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
