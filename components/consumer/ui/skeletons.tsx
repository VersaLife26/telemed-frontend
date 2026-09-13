import { Card } from "@/components/consumer/ui/Card";
import { LoadingRegion, Skeleton } from "@/components/consumer/ui/Skeleton";

export function HomeSkeleton() {
  return (
    <LoadingRegion label="Loading home" className="flex flex-col gap-8">
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-3 h-5 w-72" />
      </div>
      <div className="overflow-hidden rounded-[20px] bg-paper p-6 shadow-[var(--shadow-ticket)]">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-4 h-14 w-36" />
        <Skeleton className="mt-4 h-6 w-48" />
        <Skeleton className="mt-6 h-12 w-40 rounded-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="aspect-[4/3] w-full rounded-xl" />
            <Skeleton className="mt-3 h-5 w-2/3" />
            <Skeleton className="mt-2 h-4 w-1/3" />
          </Card>
        ))}
      </div>
    </LoadingRegion>
  );
}

export function AppointmentsSkeleton() {
  return (
    <LoadingRegion label="Loading appointments" className="flex flex-col gap-3">
      {Array.from({ length: 4 }, (_, i) => (
        <Card key={i} className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-2 h-4 w-56" />
          </div>
          <Skeleton className="h-10 w-28 rounded-full" />
        </Card>
      ))}
    </LoadingRegion>
  );
}

export function DoctorsSkeleton() {
  return (
    <LoadingRegion label="Loading doctors" className="flex flex-col gap-6">
      <Skeleton className="h-12 w-full rounded-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="aspect-[4/3] w-full rounded-xl" />
            <Skeleton className="mt-3 h-5 w-2/3" />
            <Skeleton className="mt-2 h-4 w-1/2" />
          </Card>
        ))}
      </div>
    </LoadingRegion>
  );
}

export function DoctorDetailSkeleton() {
  return (
    <LoadingRegion label="Loading doctor" className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row">
        <Skeleton className="mx-auto size-[280px] rounded-[var(--radius-card)] lg:mx-0 lg:size-[320px]" />
        <Card className="min-h-[240px] flex-1">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-4 h-5 w-full" />
          <Skeleton className="mt-2 h-5 w-2/3" />
        </Card>
      </div>
      <Card>
        <Skeleton className="h-6 w-40" />
        <div className="mt-4 flex flex-wrap gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-11 w-20 rounded-full" />
          ))}
        </div>
      </Card>
    </LoadingRegion>
  );
}

export function VaultSkeleton() {
  return (
    <LoadingRegion label="Loading vault" className="flex flex-col gap-4">
      <Skeleton className="h-8 w-40" />
      <Card>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-3 h-12 w-full rounded-full" />
      </Card>
      {Array.from({ length: 3 }, (_, i) => (
        <Card key={i}>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="mt-2 h-4 w-32" />
        </Card>
      ))}
    </LoadingRegion>
  );
}

export function ProfileSkeleton() {
  return (
    <LoadingRegion label="Loading profile" className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-12 w-32 rounded-full" />
      </Card>
    </LoadingRegion>
  );
}

export function FormSkeleton() {
  return (
    <LoadingRegion label="Loading form" className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-12 w-full rounded-full" />
        <Skeleton className="h-12 w-40 rounded-full" />
      </Card>
    </LoadingRegion>
  );
}
