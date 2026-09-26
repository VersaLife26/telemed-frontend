"use client";

import * as React from "react";
import { TicketPercent } from "lucide-react";

import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { endpoints } from "@/lib/admin/api/endpoints";
import { useApiMutation } from "@/lib/admin/api/hooks";
import type { CreatePromoCodeRequest, PromoCode } from "@/lib/admin/api/types";
import { formatDateTime, formatMoney } from "@/lib/admin/format";

export function PromoCodesPanel({ codes }: { codes: PromoCode[] }) {
  const [code, setCode] = React.useState("");
  const [discountType, setDiscountType] = React.useState<"percent" | "fixed">("percent");
  const [percent, setPercent] = React.useState("10");
  const [amount, setAmount] = React.useState("50000");
  const [description, setDescription] = React.useState("");

  const create = useApiMutation<PromoCode, void>({
    method: "POST",
    path: () => endpoints.finance.createPromoCode(),
    body: (): CreatePromoCodeRequest => ({
      code: code.trim(),
      description: description.trim() || null,
      discountType,
      percentBps: discountType === "percent" ? Math.round(Number(percent) * 100) : null,
      amountOffCents: discountType === "fixed" ? Number(amount) : null,
      maxDiscountCents: null,
      minAmountCents: 0,
      validFrom: null,
      validUntil: null,
      maxRedemptions: null,
      maxPerUser: 1,
    }),
    successMessage: () => "Promo code issued.",
    onSuccess: () => {
      setCode("");
      setDescription("");
    },
  });

  const deactivate = useApiMutation<PromoCode, PromoCode>({
    method: "POST",
    path: (variables) => endpoints.finance.deactivatePromoCode(variables.id),
    successMessage: (_result, variables) => `${variables.code} deactivated.`,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Promo codes</CardTitle>
        <CardDescription>
          Percent or fixed discounts a patient applies at checkout.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="promo-code">Code</Label>
            <Input
              id="promo-code"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              required
              minLength={3}
              maxLength={32}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="promo-type">Discount</Label>
            <Select
              value={discountType}
              onValueChange={(value) => setDiscountType(value as "percent" | "fixed")}
            >
              <SelectTrigger id="promo-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">Percent</SelectItem>
                <SelectItem value="fixed">Fixed cents</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {discountType === "percent" ? (
            <div className="space-y-1">
              <Label htmlFor="promo-percent">Percent</Label>
              <Input
                id="promo-percent"
                type="number"
                min={1}
                max={100}
                value={percent}
                onChange={(event) => setPercent(event.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-1">
              <Label htmlFor="promo-amount">Amount (cents)</Label>
              <Input
                id="promo-amount"
                type="number"
                min={1}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
          )}
          <div className="space-y-1 sm:col-span-2 lg:col-span-1">
            <Label htmlFor="promo-description">Description</Label>
            <Input
              id="promo-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={create.isPending || code.trim().length < 3}>
              Issue code
            </Button>
          </div>
        </form>

        {codes.length === 0 ? (
          <EmptyState
            icon={TicketPercent}
            title="No promo codes"
            description="Issue a code to apply a percent or fixed discount at checkout."
          />
        ) : (
          <ul className="space-y-3">
            {codes.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-4"
              >
                <div className="space-y-1">
                  <p className="font-mono text-sm font-medium">
                    {item.code}
                    <Badge className="ml-2" variant={item.isActive ? "success" : "muted"}>
                      {item.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {item.discountType === "percent"
                      ? `${(item.percentBps ?? 0) / 100}% off`
                      : formatMoney(item.amountOffCents ?? 0, item.currency)}
                    {item.description ? ` · ${item.description}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.redemptionCount} redemption{item.redemptionCount === 1 ? "" : "s"}
                    {item.maxRedemptions ? ` / ${item.maxRedemptions}` : ""} · created{" "}
                    {formatDateTime(item.createdAt)}
                  </p>
                </div>
                {item.isActive ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={deactivate.isPending}
                    onClick={() => deactivate.mutate(item)}
                  >
                    Deactivate
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
