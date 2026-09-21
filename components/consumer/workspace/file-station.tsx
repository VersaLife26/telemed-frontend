"use client";

import { VaultBrowser } from "@/components/consumer/vault/vault-browser";
import type { VaultDocument } from "@/lib/consumer/api/types";
import type { CallPointerBind } from "@/lib/consumer/features/pointer";

export function FileStationApp({
  lockedRoot,
  onOpenFile,
  pointer,
}: {
  lockedRoot?: string | null;
  onOpenFile: (doc: VaultDocument) => void;
  pointer?: CallPointerBind | null;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col text-white">
      <VaultBrowser
        mode="doctor"
        lockedRoot={lockedRoot}
        onOpenFile={onOpenFile}
        dark
        pointer={pointer}
      />
    </div>
  );
}
