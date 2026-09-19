import { notFound } from "next/navigation";

import { WorkspaceDesktop } from "@/components/consumer/workspace/desktop";
import { SURFACE } from "@/lib/consumer/surface";

export default function WorkspacePage() {
  if (SURFACE !== "doctor") notFound();
  return <WorkspaceDesktop />;
}
