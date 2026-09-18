"use client";

import { useApiQuery } from "@/lib/admin/api/hooks";
import { endpoints } from "@/lib/admin/api/endpoints";
import type { SystemConfig } from "@/lib/admin/api/types";
import { formatDateTime } from "@/lib/admin/format";

export function ConfigHistory({
  configKey,
  path,
}: {
  configKey: string;
  path?: string;
}) {
  const history = useApiQuery<SystemConfig[]>(
    ["config-history", path ?? configKey],
    path ?? endpoints.settings.configHistory(configKey),
  );

  if (history.isPending) {
    return <p className="text-xs text-muted-foreground">Loading previous versions…</p>;
  }
  if (history.isError) {
    return (
      <p className="text-xs text-destructive">{history.error.userMessage}</p>
    );
  }
  const rows = history.data ?? [];
  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground">No previous versions.</p>;
  }

  return (
    <ol className="space-y-2 text-xs">
      {rows.map((row) => (
        <li key={`${row.key}-${row.version}`} className="rounded-md border border-border p-2">
          <p className="font-medium">Version {row.version}</p>
          <p className="text-muted-foreground">
            {formatDateTime(row.created_at)}
            {row.updated_by ? ` · ${row.updated_by}` : ""}
          </p>
          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap font-mono">
            {JSON.stringify(row.value, null, 2)}
          </pre>
        </li>
      ))}
    </ol>
  );
}
