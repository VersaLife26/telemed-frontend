import Image from "next/image";
import Link from "next/link";
import type { Doctor } from "@/lib/consumer/api/types";
import { Card } from "@/components/consumer/ui/Card";
import { assets } from "@/lib/consumer/assets";
import { formatMoney } from "@/lib/consumer/money";

export function DoctorCard({ doctor }: { doctor: Doctor }) {
  const name = doctor.display_name || "Doctor";
  return (
    <Link href={`/doctors/${doctor.id}`} className="block h-full">
      <Card className="flex h-full flex-col gap-3 p-4 transition-[transform,box-shadow] duration-[200ms] ease-[var(--ease-out)] hover:shadow-[var(--shadow-ticket)]">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-linen">
          <Image
            src={doctor.photo_url || assets.doctorPhoto}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
            unoptimized={Boolean(doctor.photo_url)}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-h5 text-ink">{name}</p>
          <p className="mt-1 text-body-sm text-text-muted">{doctor.specialty || "General"}</p>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <p className="text-body font-medium text-primary tabular-time">
              {formatMoney(doctor.fee_cents, doctor.currency)}
            </p>
            {doctor.rating != null ? (
              <p className="text-caption text-text-label">
                {doctor.rating.toFixed(1)} ({doctor.review_count ?? 0})
              </p>
            ) : null}
          </div>
        </div>
      </Card>
    </Link>
  );
}
