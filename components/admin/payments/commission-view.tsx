import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
import type { Commission } from "@/lib/admin/api/types";
import { formatMoney } from "@/lib/admin/format";

/**
 * The platform's commission policy. Read-only: commission, the provider fee
 * and the payout hold are code constants in the API, so there is nothing to
 * edit here.
 */
export function CommissionView({ commission }: { commission: Commission }) {
  const rows: Array<[string, string]> = [
    ["Platform commission", `${commission.commissionBps / 100}% of each captured payment`],
    [
      "Payment provider fee",
      `${commission.providerFeeBps / 100}% + ${formatMoney(commission.providerFeeFixedCents, commission.currency)}`,
    ],
    ["Payout hold", `${commission.payoutHoldHours} hours after capture`],
    ["Currency", commission.currency],
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Commission policy</CardTitle>
        <CardDescription>
          Fixed by the platform. Changing these values is a code change, not a console
          setting.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
  );
}
