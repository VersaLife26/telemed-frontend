import Link from "next/link";
import { Card } from "@/components/consumer/layout/AppShell";
import { apiFetch } from "@/lib/consumer/api/client";
import type { Doctor } from "@/lib/consumer/api/types";

function feeLabel(cents?: number, currency = "LKR") {
  if (cents == null) return "—";
  return `${currency} ${(cents / 100).toLocaleString()}`;
}

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
    error = e instanceof Error ? e.message : "Failed to load doctors";
  }

  return (
    <div className="flex flex-col gap-6">
      <form className="flex flex-col gap-3 sm:flex-row">
        <input
          name="q"
          defaultValue={q || ""}
          placeholder="Search specialty or name"
          className="w-full rounded-[32px] border border-transparent bg-bg-gray px-6 py-3 text-body shadow-[var(--shadow-soft)] outline-none focus:border-primary-light"
        />
        <button
          type="submit"
          className="rounded-[32px] bg-primary px-8 py-3 font-bold text-white"
        >
          Search
        </button>
      </form>

      {error ? <p className="text-body-sm text-danger">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {doctors.map((d) => (
          <Link key={d.id} href={`/doctors/${d.id}`}>
            <Card className="h-full hover:border-border-card">
              <p className="text-h5 text-black">{d.display_name || "Doctor"}</p>
              <p className="mt-2 text-body-sm text-text-muted">{d.specialty}</p>
              <p className="mt-4 text-body text-primary">{feeLabel(d.fee_cents, d.currency)}</p>
            </Card>
          </Link>
        ))}
      </div>
      {!error && doctors.length === 0 ? (
        <p className="text-body text-text-muted">No doctors found.</p>
      ) : null}
    </div>
  );
}
