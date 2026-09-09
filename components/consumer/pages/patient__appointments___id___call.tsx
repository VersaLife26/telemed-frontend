import { VideoCallClient } from "@/components/consumer/video-call-client";
import { afterEndPath } from "@/lib/consumer/features/consult";

export default async function CallPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <VideoCallClient
      appointmentId={id}
      role="patient"
      afterEndHref={afterEndPath("patient", id)}
    />
  );
}
