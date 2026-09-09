import Link from "next/link";
import { Card } from "@/components/consumer/layout/AppShell";
import { Button } from "@/components/consumer/ui/Button";
import { apiFetch } from "@/lib/consumer/api/client";
import type { Appointment, Doctor, PageMeta } from "@/lib/consumer/api/types";
import { getAccessToken } from "@/lib/consumer/auth/cookies";

async function loadHome() {
  try {
    const doctors = await apiFetch<Doctor[]>("/api/v1/doctors?per_page=6&sort=rating");
    return { doctors: Array.isArray(doctors) ? doctors : [], error: null as string | null };
  } catch (e) {
    return {
      doctors: [] as Doctor[],
      error: e instanceof Error ? e.message : "Gateway unreachable",
    };
  }
}

async function loadAppointments(token: string | undefined) {
  if (!token) return [] as Appointment[];
  try {
    return await apiFetch<Appointment[]>("/api/v1/appointments?per_page=5", { token });
  } catch {
    return [];
  }
}

function feeLabel(cents?: number, currency = "LKR") {
  if (cents == null) return "—";
  return `${currency} ${(cents / 100).toLocaleString()}`;
}

export default async function HomePage() {
  const token = await getAccessToken();
  const [{ doctors, error }, appointments] = await Promise.all([
    loadHome(),
    loadAppointments(token),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <Card className="flex flex-col gap-4">
        <h2 className="text-h4 text-black">Find care today</h2>
        <p className="text-body text-text-muted">
          Browse approved doctors and book a video consult through the telemed platform.
        </p>
        <Link href="/doctors" className="max-w-xs">
          <Button>Browse doctors</Button>
        </Link>
        {error ? (
          <p className="text-body-sm text-danger">
            Live doctor list unavailable: {error}. Start `telemed-api-gateway` (and services) to
            load data.
          </p>
        ) : null}
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="text-h4 text-black">Top doctors</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {doctors.map((d) => (
            <Link key={d.id} href={`/doctors/${d.id}`}>
              <Card className="h-full transition hover:border-border-card">
                <p className="text-h5 text-black">{d.display_name || "Doctor"}</p>
                <p className="mt-2 text-body-sm text-text-muted">{d.specialty || "General"}</p>
                <p className="mt-4 text-body text-primary">{feeLabel(d.fee_cents, d.currency)}</p>
                {d.rating != null ? (
                  <p className="mt-1 text-caption text-text-label">
                    ★ {d.rating.toFixed(1)} ({d.review_count ?? 0})
                  </p>
                ) : null}
              </Card>
            </Link>
          ))}
          {!error && doctors.length === 0 ? (
            <p className="text-body text-text-muted">No doctors returned yet.</p>
          ) : null}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-h4 text-black">Your appointments</h2>
          <Link href="/appointments" className="text-body-sm text-primary">
            View all
          </Link>
        </div>
        {!token ? (
          <Card>
            <p className="text-body text-text-muted">Sign in with OTP to see your bookings.</p>
          </Card>
        ) : appointments.length === 0 ? (
          <Card>
            <p className="text-body text-text-muted">No appointments yet.</p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {appointments.map((a) => (
              <Card key={a.id}>
                <p className="text-body font-medium text-black">{a.specialty || "Consultation"}</p>
                <p className="text-body-sm text-text-muted">
                  {a.start_at_local || a.start_at} · {a.status}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
