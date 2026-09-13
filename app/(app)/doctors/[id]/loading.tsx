import { SURFACE } from "@/lib/consumer/surface";
import { DoctorDetailSkeleton } from "@/components/consumer/ui/skeletons";

export default function Loading() {
  if (SURFACE !== "patient") return null;
  return <DoctorDetailSkeleton />;
}
