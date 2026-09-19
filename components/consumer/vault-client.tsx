"use client";

import { VaultBrowser } from "@/components/consumer/vault/vault-browser";
import { PageHero } from "@/components/consumer/ui/PageHero";
import { HEROES } from "@/lib/consumer/heroes";

export function VaultClient() {
  return (
    <div className="flex flex-col gap-6">
      <PageHero {...HEROES.vault} />
      <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-sm">
        <VaultBrowser mode="owner" />
      </div>
    </div>
  );
}
