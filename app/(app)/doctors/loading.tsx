import { SURFACE } from "@/lib/consumer/surface";
import { DoctorsSkeleton } from "@/components/consumer/ui/skeletons";

export default function Loading() {
  if (SURFACE !== "patient") return null;
  return <DoctorsSkeleton />;
}
