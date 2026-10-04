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
import { Label } from "@/components/admin/ui/label";
import { Switch } from "@/components/admin/ui/switch";
import { endpoints } from "@/lib/admin/api/endpoints";
import { useApiMutation } from "@/lib/admin/api/hooks";
import type { BillingSettings, UpdateCardHoldRequest } from "@/lib/admin/api/types";

export function CardHoldForm({ settings }: { settings: BillingSettings }) {
  const [holdLkr, setHoldLkr] = React.useState(settings.holdLkrWithinSixDays);
  const [holdUsd, setHoldUsd] = React.useState(settings.holdUsdWithinSixDays);

  const save = useApiMutation<BillingSettings, UpdateCardHoldRequest>({
    method: "PUT",
    path: () => endpoints.finance.cardHold(),
    body: (variables) => variables,
    successMessage: () => "Card hold settings saved.",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Card hold</CardTitle>
        <CardDescription>
          For a visit starting within 6 days, PayHere can hold the card and capture the amount
          after the consultation. Turn a switch off to charge that currency immediately. A visit
          further away is always charged immediately, because a hold expires after 7 days. Leave
          both off until PayHere has enabled Hold on Card for that merchant.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex max-w-lg flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate({ holdLkrWithinSixDays: holdLkr, holdUsdWithinSixDays: holdUsd });
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="hold-lkr" className="cursor-pointer">
              Hold LKR cards within 6 days
            </Label>
            <Switch id="hold-lkr" checked={holdLkr} onCheckedChange={setHoldLkr} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="hold-usd" className="cursor-pointer">
              Hold USD cards within 6 days
            </Label>
            <Switch id="hold-usd" checked={holdUsd} onCheckedChange={setHoldUsd} />
          </div>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save card hold"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
