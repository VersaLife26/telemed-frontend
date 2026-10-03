"use client";

import * as React from "react";

import { Button } from "@/components/admin/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { endpoints } from "@/lib/admin/api/endpoints";
import { useApiMutation } from "@/lib/admin/api/hooks";
import type { BillingSettings, UpdateBillingSettingsRequest } from "@/lib/admin/api/types";

function parseRate(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+(\.\d{1,4})?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 1 || value > 100_000) return null;
  return value;
}

export function InternationalRateForm({ settings }: { settings: BillingSettings }) {
  const [rate, setRate] = React.useState(
    settings.lkrPerUsd == null ? "" : String(settings.lkrPerUsd),
  );
  const parsed = parseRate(rate);

  const save = useApiMutation<BillingSettings, UpdateBillingSettingsRequest>({
    method: "PUT",
    path: () => endpoints.finance.billing(),
    body: (variables) => variables,
    successMessage: (result) => `Exchange rate saved at ${result.lkrPerUsd} LKR per USD.`,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>International exchange rate</CardTitle>
        <CardDescription>
          How many rupees buy one US dollar. An international patient pays the doctor&apos;s LKR
          fee times that doctor&apos;s multiplier, converted at this rate. A LKR 2,500 fee at ×4
          and 300 rupees per dollar is USD 33.33. Leave this unset and international booking stays
          closed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex max-w-sm flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (parsed == null) return;
            save.mutate({ lkrPerUsd: parsed });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="lkr-per-usd">LKR per 1 USD</Label>
            <Input
              id="lkr-per-usd"
              inputMode="decimal"
              value={rate}
              onChange={(event) => setRate(event.target.value)}
              placeholder="300"
              aria-invalid={rate.trim() !== "" && parsed == null}
            />
            <p className="text-sm text-muted-foreground">From 1 to 100,000, with at most 4 decimal places.</p>
          </div>
          <Button type="submit" disabled={parsed == null || save.isPending}>
            {save.isPending ? "Saving…" : "Save rate"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
