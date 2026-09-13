import { DoctorCard } from "@/components/consumer/ui/DoctorCard";
import { EmptyState } from "@/components/consumer/ui/EmptyState";
import { Button } from "@/components/consumer/ui/Button";
import { Input } from "@/components/consumer/ui/Input";
import { apiFetch } from "@/lib/consumer/api/client";
import type { Doctor } from "@/lib/consumer/api/types";

export default async function DoctorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  let doctors: Doctor[] = [];
  let error: string | null = null;
  try {
    const qs = new URLSearchParams({ per_page: "30", sort: "rating" });
    if (q) qs.set("q", q);
    const data = await apiFetch<Doctor[]>(`/api/v1/doctors?${qs}`);
    doctors = Array.isArray(data) ? data : [];
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load doctors";
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-h3 text-ink">Doctors</h1>
        <p className="mt-1 text-body text-text-muted">Search by name or specialty, then pick a slot.</p>
      </header>

      <form className="flex flex-col gap-3 sm:flex-row" role="search">
        <label className="sr-only" htmlFor="doctor-search">
          Search specialty or name
        </label>
        <Input
          id="doctor-search"
          name="q"
          defaultValue={q || ""}
          placeholder="Search specialty or name"
          className="flex-1"
        />
        <Button type="submit" className="min-h-12 sm:min-w-32">
          Search
        </Button>
      </form>

      {error ? (
        <EmptyState title="Couldn’t load doctors" body={error} action={{ href: "/doctors", label: "Try again" }} />
      ) : null}

      {!error && doctors.length === 0 ? (
        <EmptyState
          title="No doctors found"
          body={q ? `Nothing matched “${q}”. Try a specialty or a shorter name.` : "Approved clinicians will appear here once the directory is live."}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {doctors.map((d) => (
          <DoctorCard key={d.id} doctor={d} />
        ))}
      </div>
    </div>
  );
}
