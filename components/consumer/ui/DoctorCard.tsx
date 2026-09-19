import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Star } from "lucide-react";

import { fallbackPortrait } from "@/lib/consumer/assets";
import { cx } from "@/lib/consumer/cx";
import type { Doctor } from "@/lib/consumer/api/types";
import { specialtyLabel } from "@/lib/consumer/features/doctor-search";
import { profilePhotoSrc } from "@/lib/consumer/features/profile";
import { formatMoney } from "@/lib/consumer/money";

/**
 * Photo-forward directory tile: the face is the identifying thing, so it gets
 * the top of the card and the fee gets the bottom edge where a scanning eye
 * ends up. A doctor with no uploaded photo gets a stable stand-in rather than
 * a grey box -- the same one on every render, keyed off the id.
 */
export function DoctorCard({ doctor, className }: { doctor: Doctor; className?: string }) {
  const name = doctor.display_name || "Doctor";
  const photo = profilePhotoSrc(doctor.photo_url) ?? fallbackPortrait(doctor.id);

  return (
    <Link
      href={`/doctors/${doctor.id}`}
      className={cx(
        "group flex h-full flex-col overflow-hidden rounded-lg bg-surface shadow-sm",
        "transition-[transform,box-shadow] duration-[200ms] ease-out",
        "can-hover:hover:-translate-y-0.5 can-hover:hover:shadow-md",
        className,
      )}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[image:var(--gradient-hero)]">
        <Image
          src={photo}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover object-top transition-transform duration-[320ms] ease-out can-hover:group-hover:scale-[1.03]"
          unoptimized
        />
        <span
          aria-hidden="true"
          className="absolute right-2.5 top-2.5 flex size-6 items-center justify-center rounded-full bg-brand-accent text-white shadow-sm"
        >
          <BadgeCheck className="size-3.5" strokeWidth={2.5} />
        </span>
      </div>

      {/* The specialty rides the photo's bottom edge, as in the kit's doctor
          cards, so the face and the field read as one label. */}
      <div className="relative z-10 -mt-3.5 flex justify-center px-4">
        <span className="max-w-full truncate rounded-pill bg-brand px-3.5 py-1.5 text-caption text-on-brand shadow-brand">
          {specialtyLabel(doctor.specialty)}
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center gap-1 px-4 pb-4 pt-3 text-center">
        <p className="w-full truncate text-h5 text-ink">{name}</p>

        <div className="mt-auto flex w-full items-center justify-between gap-2 border-t border-border-subtle pt-3">
          <span className="text-label text-brand tabular-time">
            {formatMoney(doctor.fee_cents, doctor.currency)}
          </span>
          {doctor.rating != null ? (
            <span className="inline-flex items-center gap-1 text-caption text-muted">
              <Star aria-hidden="true" className="size-3.5 fill-current text-warning" />
              {doctor.rating.toFixed(1)}
              <span className="text-faint">({doctor.review_count ?? 0})</span>
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
