import Image from "next/image";

import { assets } from "@/lib/consumer/assets";
import { cx } from "@/lib/consumer/cx";

/**
 * A round photo with a deterministic initials fallback, so a missing or
 * blocked image leaves a legible identity rather than a grey hole.
 */
export function Avatar({
  src,
  name,
  size = 44,
  className,
  ring = false,
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  const initials = (name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      style={{ width: size, height: size }}
      className={cx(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-tint text-label text-brand",
        ring && "ring-2 ring-surface",
        className,
      )}
    >
      {initials || null}
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          className="object-cover"
          unoptimized={src !== assets.avatarPlaceholder}
        />
      ) : null}
    </span>
  );
}
