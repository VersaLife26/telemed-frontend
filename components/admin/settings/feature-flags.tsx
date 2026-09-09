"use client";

import * as React from "react";
import { Flag, Save } from "lucide-react";

import { Button } from "@/components/admin/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { Label } from "@/components/admin/ui/label";
import { Switch } from "@/components/admin/ui/switch";
import { endpoints } from "@/lib/admin/api/endpoints";
import { useApiMutation } from "@/lib/admin/api/hooks";
import { CONFIG_KEYS, type FeatureFlag, type SystemConfig } from "@/lib/admin/api/types";
import { formatDateTime } from "@/lib/admin/format";

/**
 * Feature flags.
 *
 * Batched rather than saved per toggle: flags are frequently flipped in
 * combination ("turn on carrier billing and turn off the old payment sheet"),
 * and two separate writes to an append-only config table produce two versions
 * with a window between them where neither state is the one anybody wanted.
 */
export function FeatureFlagsCard({
  config,
  readOnly,
}: {
  config: SystemConfig<FeatureFlag[]>;
  readOnly: boolean;
}) {
  const initial = React.useMemo(
    () => Object.fromEntries((config.value ?? []).map((flag) => [flag.key, flag.enabled])),
    [config.value],
  );
  const [state, setState] = React.useState<Record<string, boolean>>(initial);

  const dirtyKeys = Object.keys(state).filter((key) => state[key] !== initial[key]);

  const mutation = useApiMutation<SystemConfig<FeatureFlag[]>, void>({
    method: "PUT",
    path: () => endpoints.settings.config(CONFIG_KEYS.featureFlags),
    body: () => ({
      value: (config.value ?? []).map((flag) => ({
        ...flag,
        enabled: state[flag.key] ?? flag.enabled,
      })),
      previous_version: config.version,
    }),
    successMessage: () => "Feature flags saved.",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature flags</CardTitle>
        <CardDescription>
          Version {config.version}, effective {formatDateTime(config.effective_from)}.
          Changes take effect as each service re-reads its configuration.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {(config.value ?? []).length === 0 ? (
          <EmptyState
            icon={Flag}
            title="No feature flags defined"
            description="Flags are declared by the services that read them; the console toggles what already exists rather than inventing new keys."
          />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {(config.value ?? []).map((flag) => (
              <li key={flag.key} className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  <Label htmlFor={`flag-${flag.key}`} className="font-mono text-sm">
                    {flag.key}
                  </Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">{flag.description}</p>
                </div>
                <Switch
                  id={`flag-${flag.key}`}
                  disabled={readOnly}
                  checked={state[flag.key] ?? flag.enabled}
                  onCheckedChange={(next) =>
                    setState((current) => ({ ...current, [flag.key]: next }))
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <CardFooter className="justify-between">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {dirtyKeys.length === 0
            ? "No unsaved changes."
            : `${dirtyKeys.length} flag${dirtyKeys.length === 1 ? "" : "s"} changed: ${dirtyKeys.join(", ")}`}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={dirtyKeys.length === 0}
            onClick={() => setState(initial)}
          >
            Discard
          </Button>
          <Button
            disabled={readOnly || dirtyKeys.length === 0 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            <Save className="size-4" aria-hidden="true" />
            {mutation.isPending ? "Saving…" : "Save flags"}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
