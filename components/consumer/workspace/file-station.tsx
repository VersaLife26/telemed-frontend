"use client";

import { VaultBrowser } from "@/components/consumer/vault/vault-browser";
import type { VaultDocument } from "@/lib/consumer/api/types";

export function FileStationApp({
  lockedRoot,
  onOpenFile,
}: {
  lockedRoot?: string | null;
  onOpenFile: (doc: VaultDocument) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col text-white">
      <VaultBrowser mode="doctor" lockedRoot={lockedRoot} onOpenFile={onOpenFile} dark />
    </div>
  );
}
