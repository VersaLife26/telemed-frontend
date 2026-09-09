import type { Metadata } from "next";

import { auth } from "@/auth";
import { PageHeader } from "@/components/admin/common/page-header";
import { CorporateClientsCard } from "@/components/admin/settings/corporate-clients";
import { FeatureFlagsCard } from "@/components/admin/settings/feature-flags";
import { NumericConfigCard } from "@/components/admin/settings/config-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/admin/ui/tabs";
import { endpoints } from "@/lib/admin/api/endpoints";
import { routeFatal } from "@/lib/admin/api/guard";
import { tryGetServer } from "@/lib/admin/api/server";
import {
  CONFIG_KEYS,
  type CancellationPolicy,
  type CorporateClient,
  type FeatureFlag,
  type FeeCaps,
  type SlotDefaults,
  type SystemConfig,
} from "@/lib/admin/api/types";
import { can } from "@/lib/admin/rbac";

export const metadata: Metadata = { title: "Settings" };

const UNSET = {
  updated_by: null,
  effective_from: new Date(0).toISOString(),
  created_at: new Date(0).toISOString(),
} as const;

/**
 * Platform configuration.
 *
 * Everything here lives in `system_configs`, which is append-only at the
 * database level: a save inserts a new version and the old row is untouchable
 * even by the application role. That is what makes "who changed the fee cap and
 * to what" answerable a year later, and it is why every editor on this page
 * shows a diff before it writes.
 */
export default async function SettingsPage() {
  const session = await auth();
  const roles = session?.roles ?? [];
  const readOnly = !can(roles, "config");
  const financeOnly = !can(roles, "finance");

  const [slots, cancellation, feeCaps, flags, corporate] = await Promise.all([
    tryGetServer<SystemConfig<SlotDefaults>>(endpoints.settings.config(CONFIG_KEYS.slotDefaults)),
    tryGetServer<SystemConfig<CancellationPolicy>>(
      endpoints.settings.config(CONFIG_KEYS.cancellationPolicy),
    ),
    tryGetServer<SystemConfig<FeeCaps>>(endpoints.settings.config(CONFIG_KEYS.feeCaps)),
    tryGetServer<SystemConfig<FeatureFlag[]>>(
      endpoints.settings.config(CONFIG_KEYS.featureFlags),
    ),
    tryGetServer<SystemConfig<CorporateClient[]>>(
      endpoints.settings.config(CONFIG_KEYS.corporateClients),
    ),
  ]);

  if (!slots.ok && slots.error.code !== "NOT_FOUND") routeFatal(slots.error);
  if (!cancellation.ok && cancellation.error.code !== "NOT_FOUND") routeFatal(cancellation.error);
  if (!feeCaps.ok && feeCaps.error.code !== "NOT_FOUND") routeFatal(feeCaps.error);
  if (!flags.ok && flags.error.code !== "NOT_FOUND") routeFatal(flags.error);
  if (!corporate.ok && corporate.error.code !== "NOT_FOUND") routeFatal(corporate.error);

  const slotConfig: SystemConfig<SlotDefaults> = slots.ok
    ? slots.data
    : {
        key: CONFIG_KEYS.slotDefaults,
        value: { slot_duration_minutes: 15, buffer_minutes: 5, horizon_days: 30, max_per_day: 24 },
        version: 0,
        ...UNSET,
      };
  const cancellationConfig: SystemConfig<CancellationPolicy> = cancellation.ok
    ? cancellation.data
    : {
        key: CONFIG_KEYS.cancellationPolicy,
        value: {
          free_cancellation_hours: 24,
          late_cancellation_fee_percent: 50,
          no_show_fee_percent: 100,
        },
        version: 0,
        ...UNSET,
      };
  const feeCapsConfig: SystemConfig<FeeCaps> = feeCaps.ok
    ? feeCaps.data
    : {
        key: CONFIG_KEYS.feeCaps,
        value: {
          currency: "LKR",
          min_fee_cents: 50_000,
          max_fee_cents: 5_000_000,
          per_specialty_max_cents: {},
        },
        version: 0,
        ...UNSET,
      };
  const flagsConfig: SystemConfig<FeatureFlag[]> = flags.ok
    ? flags.data
    : { key: CONFIG_KEYS.featureFlags, value: [], version: 0, ...UNSET };
  const corporateConfig: SystemConfig<CorporateClient[]> = corporate.ok
    ? corporate.data
    : { key: CONFIG_KEYS.corporateClients, value: [], version: 0, ...UNSET };

  return (
    <>
      <PageHeader
        title="Settings"
        description="Slot generation defaults, cancellation policy, consultation fee caps, feature flags and corporate cover. Every value is versioned; saving never overwrites the previous version."
      />

      <Tabs defaultValue="scheduling">
        <TabsList>
          <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
          <TabsTrigger value="policy">Policy</TabsTrigger>
          <TabsTrigger value="fees">Fee caps</TabsTrigger>
          <TabsTrigger value="flags">Feature flags</TabsTrigger>
          <TabsTrigger value="corporate">Corporate</TabsTrigger>
        </TabsList>

        <TabsContent value="scheduling">
          <NumericConfigCard<SlotDefaults>
            title="Slot defaults"
            description="Applied to a doctor who has not set their own. The nightly generator uses these when it materialises the next horizon of slots."
            configKey={CONFIG_KEYS.slotDefaults}
            config={slotConfig}
            readOnly={readOnly}
            fields={[
                {
                  key: "slot_duration_minutes",
                  label: "Slot duration",
                  unit: "minutes",
                  min: 5,
                  max: 120,
                  step: 5,
                  help: "How long one consultation slot is. The docs assume 15, 30 or 60.",
                },
                {
                  key: "buffer_minutes",
                  label: "Buffer between slots",
                  unit: "minutes",
                  min: 0,
                  max: 60,
                  step: 5,
                  help: "Gap after each slot. Raising this reduces how many slots fit in a working day.",
                },
                {
                  key: "horizon_days",
                  label: "Generation horizon",
                  unit: "days",
                  min: 1,
                  max: 90,
                  help: "How far ahead slots are pre-generated. Longer horizons mean more rows and a longer nightly job.",
                },
                {
                  key: "max_per_day",
                  label: "Maximum slots per day",
                  unit: "slots",
                  min: 1,
                  max: 100,
                  help: "Hard cap per doctor per day, regardless of working hours.",
                },
              ]}
            />
        </TabsContent>

        <TabsContent value="policy">
          <NumericConfigCard<CancellationPolicy>
            title="Cancellation policy"
            description="What a patient is charged when they cancel late or do not attend."
            configKey={CONFIG_KEYS.cancellationPolicy}
            config={cancellationConfig}
            readOnly={readOnly}
            fields={[
                {
                  key: "free_cancellation_hours",
                  label: "Free cancellation window",
                  unit: "hours before",
                  min: 0,
                  max: 168,
                  help: "Cancelling more than this far ahead is always free.",
                },
                {
                  key: "late_cancellation_fee_percent",
                  label: "Late cancellation fee",
                  unit: "% of fee",
                  min: 0,
                  max: 100,
                  step: 5,
                  help: "Charged when a patient cancels inside the free window.",
                },
                {
                  key: "no_show_fee_percent",
                  label: "No-show fee",
                  unit: "% of fee",
                  min: 0,
                  max: 100,
                  step: 5,
                  help: "Charged when a patient does not attend at all.",
                },
              ]}
            />
        </TabsContent>

        <TabsContent value="fees">
          <NumericConfigCard<FeeCaps>
            title="Consultation fee caps"
            description="The range a doctor may set their own consultation fee within. Values are in cents; LKR 1,000 is 100000."
            configKey={CONFIG_KEYS.feeCaps}
            config={feeCapsConfig}
            readOnly={readOnly || financeOnly}
            fields={[
                {
                  key: "min_fee_cents",
                  label: "Minimum fee",
                  unit: "cents",
                  min: 0,
                  max: 100_000_00,
                  step: 100,
                  help: "A doctor cannot set a fee below this. Stops a race to the bottom that would make the platform look unserious.",
                },
                {
                  key: "max_fee_cents",
                  label: "Maximum fee",
                  unit: "cents",
                  min: 0,
                  max: 100_000_00,
                  step: 100,
                  help: "A doctor cannot set a fee above this. Per-specialty overrides are configured directly on the config key.",
                },
              ]}
            />
        </TabsContent>

        <TabsContent value="flags">
          <FeatureFlagsCard config={flagsConfig} readOnly={readOnly} />
        </TabsContent>

        <TabsContent value="corporate">
          <CorporateClientsCard config={corporateConfig} />
        </TabsContent>
      </Tabs>
    </>
  );
}
