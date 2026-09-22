import { SURFACE } from "@/lib/consumer/surface";
import DoctorVisitDetailPage from "@/components/consumer/pages/doctor__appointments___id___visit";
import { redirect } from "next/navigation";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (SURFACE !== "doctor") {
    redirect(`/appointments/${id}/summary`);
  }
  return <DoctorVisitDetailPage appointmentId={id} />;
}
