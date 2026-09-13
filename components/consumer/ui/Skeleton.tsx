import { cx } from "@/lib/consumer/cx";

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cx("skeleton-pulse rounded-md bg-skeleton", className)}
    />
  );
}

export function LoadingRegion({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={className}
    >
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
