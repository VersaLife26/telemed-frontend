import { WaitingRoomClient } from "@/components/consumer/waiting-room-client";

export default async function WaitingRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WaitingRoomClient appointmentId={id} />;
}
