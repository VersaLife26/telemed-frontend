"use client";

import * as React from "react";

import { EmptyState } from "@/components/admin/ui/empty-state";
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
import { endpoints, query } from "@/lib/admin/api/endpoints";
import { useApiList, useApiMutation } from "@/lib/admin/api/hooks";
import type { AdminDoctorListItem, Commission, DoctorCommission } from "@/lib/admin/api/types";
import { formatMoney } from "@/lib/admin/format";

function percentFromBps(bps: number) {
  return String(bps / 100);
}

function bpsFromPercent(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

export function CommissionView({ commission }: { commission: Commission }) {
  const [defaultPercent, setDefaultPercent] = React.useState(percentFromBps(commission.commissionBps));
  const [search, setSearch] = React.useState("");
  const [picked, setPicked] = React.useState<AdminDoctorListItem | null>(null);
  const [overridePercent, setOverridePercent] = React.useState("");

  React.useEffect(() => {
    setDefaultPercent(percentFromBps(commission.commissionBps));
  }, [commission.commissionBps]);

  const saveDefault = useApiMutation<Commission, void>({
    method: "PUT",
    path: () => endpoints.finance.commission(),
    body: () => ({ commissionBps: bpsFromPercent(defaultPercent) }),
    successMessage: () => "Default commission saved. New payments use this rate unless a doctor has an override.",
  });

  const saveDoctor = useApiMutation<Commission, { doctorId: string; commissionBps: number | null }>({
    method: "PUT",
    path: (variables) => endpoints.finance.doctorCommission(variables.doctorId),
    body: (variables) => ({ commissionBps: variables.commissionBps }),
    successMessage: (_result, variables) =>
      variables.commissionBps == null
        ? "Doctor now uses the default commission."
        : "Doctor commission saved.",
    onSuccess: (_result, variables) => {
      if (variables.commissionBps != null) {
        setSearch("");
        setPicked(null);
        setOverridePercent("");
      }
    },
  });

  const doctors = useApiList<AdminDoctorListItem>(
    ["admin-doctors-commission", search],
    endpoints.doctors.list(query({ q: search.trim(), pageSize: 8 })),
    { enabled: search.trim().length >= 2 && picked == null },
  );

  const rows: Array<[string, string]> = [
    [
      "Payment provider fee",
      `${commission.providerFeeBps / 100}% + ${formatMoney(commission.providerFeeFixedCents, commission.currency)}`,
    ],
    ["Payout hold", `${commission.payoutHoldHours} hours after capture`],
    ["Currency", commission.currency],
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Default commission</CardTitle>
          <CardDescription>
            Used for every doctor who does not have a specific rate. Changing it
            applies to new payments only; already captured splits stay as they were.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              saveDefault.mutate();
            }}
          >
            <div className="grid min-w-0 flex-1 gap-2">
              <Label htmlFor="default-commission">Platform commission (%)</Label>
              <Input
                id="default-commission"
                type="number"
                min={0}
                max={97}
                step="0.01"
                inputMode="decimal"
                value={defaultPercent}
                onChange={(event) => setDefaultPercent(event.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={saveDefault.isPending}>
              {saveDefault.isPending ? "Saving…" : "Save default"}
            </Button>
          </form>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[auto_1fr]">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Doctor rates</CardTitle>
          <CardDescription>
            Optional overrides. Anyone not listed uses the default{" "}
            {commission.commissionBps / 100}%.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form
            className="grid gap-3 lg:grid-cols-[1fr_8rem_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              if (!picked) return;
              const bps = bpsFromPercent(overridePercent);
              if (bps == null) return;
              saveDoctor.mutate({ doctorId: picked.id, commissionBps: bps });
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="doctor-search">Doctor</Label>
              {picked ? (
                <div className="flex h-10 items-center justify-between rounded-md border border-input bg-card px-3 text-sm">
                  <span>
                    {picked.displayName}{" "}
                    <span className="font-mono text-muted-foreground">{picked.slmcNumber}</span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPicked(null);
                      setSearch("");
                    }}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <Input
                  id="doctor-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name or SLMC"
                  autoComplete="off"
                />
              )}
              {!picked && search.trim().length >= 2 && doctors.data ? (
                <ul className="overflow-hidden rounded-md border border-border bg-card text-sm">
                  {doctors.data.items.length === 0 ? (
                    <li className="px-3 py-2 text-muted-foreground">No doctors match.</li>
                  ) : (
                    doctors.data.items.map((doctor) => (
                      <li key={doctor.id}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between px-3 py-2 text-left can-hover:hover:bg-muted"
                          onClick={() => {
                            setPicked(doctor);
                            setOverridePercent(
                              percentFromBps(doctor.commissionBps ?? commission.commissionBps),
                            );
                          }}
                        >
                          <span>{doctor.displayName}</span>
                          <span className="font-mono text-muted-foreground">{doctor.slmcNumber}</span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="doctor-commission">Rate (%)</Label>
              <Input
                id="doctor-commission"
                type="number"
                min={0}
                max={97}
                step="0.01"
                inputMode="decimal"
                value={overridePercent}
                onChange={(event) => setOverridePercent(event.target.value)}
                disabled={!picked}
                required
              />
            </div>
            <Button type="submit" className="self-end" disabled={!picked || saveDoctor.isPending}>
              {saveDoctor.isPending ? "Saving…" : "Save rate"}
            </Button>
          </form>

          {commission.doctorRates.length === 0 ? (
            <EmptyState
              title="No doctor overrides"
              description="Every doctor currently uses the default platform commission."
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-medium">Doctor</th>
                  <th className="py-2 font-medium">SLMC</th>
                  <th className="py-2 font-medium tabular-nums">Rate</th>
                  <th className="py-2 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {commission.doctorRates.map((row: DoctorCommission) => (
                  <tr key={row.doctorId} className="border-b last:border-0">
                    <td className="py-2">{row.displayName}</td>
                    <td className="py-2 font-mono">{row.slmcNumber}</td>
                    <td className="py-2 tabular-nums">{row.commissionBps / 100}%</td>
                    <td className="py-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={saveDoctor.isPending}
                        onClick={() =>
                          saveDoctor.mutate({ doctorId: row.doctorId, commissionBps: null })
                        }
                      >
                        Use default
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
