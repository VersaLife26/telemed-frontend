import { redirect } from "next/navigation";

export default async function WaitingRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/appointments/${id}/call`);
}
