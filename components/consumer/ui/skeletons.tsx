import { Card } from "@/components/consumer/ui/Card";
import { LoadingRegion, Skeleton } from "@/components/consumer/ui/Skeleton";

/**
 * Page-level skeletons. Each one mirrors the layout it stands in for -- same
 * container, same rhythm, same radii -- so the swap to real content is a
 * fill, not a jump.
 */

export function HomeSkeleton() {
  return (
    <LoadingRegion label="Loading home" className="flex flex-col gap-12">
      <div className="rounded-xl bg-[image:var(--gradient-hero)] p-6 md:p-8">
        <Skeleton className="h-5 w-40 bg-white/50" />
        <Skeleton className="mt-2 h-9 w-56 bg-white/50" />
        <div className="mt-6 rounded-xl bg-surface p-6 shadow-lg">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-4 h-14 w-40" />
          <Skeleton className="mt-5 h-11 w-56" />
        </div>
      </div>
      <div className="flex flex-col gap-5">
        <Skeleton className="h-7 w-48" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="overflow-hidden rounded-lg bg-surface shadow-sm">
              <Skeleton className="aspect-[4/3] w-full rounded-none" />
              <div className="p-4">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="mt-2 h-4 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}

export function AppointmentsSkeleton() {
  return (
    <LoadingRegion label="Loading appointments" className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-2 h-5 w-72" />
      </div>
      <Skeleton className="h-11 w-64 rounded-pill" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} className="flex items-center gap-4">
            <Skeleton className="size-11 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-2 h-4 w-56" />
            </div>
            <Skeleton className="h-11 w-28 rounded-pill" />
          </Card>
        ))}
      </div>
    </LoadingRegion>
  );
}

export function DoctorsSkeleton() {
  return (
    <LoadingRegion label="Loading doctors" className="flex flex-col gap-8">
      <div>
        <Skeleton className="h-9 w-40" />
        <Skeleton className="mt-2 h-5 w-80" />
      </div>
      <div className="glass-panel flex flex-col gap-4 p-5 md:p-6">
        <Skeleton className="h-11 w-full rounded-md" />
        <div className="grid gap-3 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-md" />
          ))}
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-lg bg-surface shadow-sm">
            <Skeleton className="aspect-[4/3] w-full rounded-none" />
            <div className="p-4">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="mt-2 h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

export function DoctorDetailSkeleton() {
  return (
    <LoadingRegion label="Loading doctor" className="flex flex-col gap-6">
      <div className="rounded-xl bg-[image:var(--gradient-hero)] p-5 md:p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <Skeleton className="mx-auto aspect-square w-56 rounded-lg bg-white/50 lg:mx-0 lg:w-72" />
          <div className="flex-1">
            <Skeleton className="h-7 w-32 rounded-pill bg-white/50" />
            <Skeleton className="mt-3 h-9 w-64 bg-white/50" />
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-12 w-full bg-white/50" />
              ))}
            </div>
          </div>
        </div>
      </div>
      <Card>
        <Skeleton className="h-7 w-40" />
        <div className="mt-4 flex flex-wrap gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-11 w-20 rounded-pill" />
          ))}
        </div>
      </Card>
    </LoadingRegion>
  );
}

export function VaultSkeleton() {
  return (
    <LoadingRegion label="Loading vault" className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="mt-2 h-5 w-80" />
      </div>
      <div className="glass-panel flex flex-col gap-4 p-6 md:flex-row md:items-end">
        <Skeleton className="h-16 flex-1 rounded-md" />
        <Skeleton className="h-12 w-40 rounded-pill" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-24 rounded-pill" />
        ))}
      </div>
      {Array.from({ length: 3 }, (_, i) => (
        <Card key={i} className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="mt-2 h-4 w-32" />
          </div>
        </Card>
      ))}
    </LoadingRegion>
  );
}

export function ProfileSkeleton() {
  return (
    <LoadingRegion label="Loading profile" className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div>
        <Skeleton className="h-9 w-40" />
        <Skeleton className="mt-2 h-5 w-72" />
      </div>
      <div className="rounded-xl bg-[image:var(--gradient-hero)] p-6">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          <Skeleton className="size-28 rounded-full bg-white/60" />
          <div className="flex-1">
            <Skeleton className="h-7 w-48 bg-white/60" />
            <Skeleton className="mt-3 h-9 w-36 rounded-pill bg-white/60" />
          </div>
        </div>
      </div>
      <Card className="flex flex-col gap-5">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-1.5 h-11 w-full rounded-md" />
          </div>
        ))}
        <Skeleton className="h-12 w-full rounded-pill" />
      </Card>
    </LoadingRegion>
  );
}

export function FormSkeleton() {
  return (
    <LoadingRegion label="Loading form" className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <Skeleton className="h-9 w-40" />
      <Card className="flex flex-col gap-5">
        <div>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-1.5 h-28 w-full rounded-md" />
        </div>
        <Skeleton className="h-12 w-full rounded-pill" />
      </Card>
    </LoadingRegion>
  );
}
