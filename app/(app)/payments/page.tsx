import type { Metadata } from "next";

import { adminRoles } from "@/lib/admin/auth/current";
import { ErrorState } from "@/components/admin/common/error-state";
import { PageHeader } from "@/components/admin/common/page-header";
import { FilterBar } from "@/components/admin/data-table/filter-bar";
import { Pagination } from "@/components/admin/data-table/pagination";
import { CommissionEditor } from "@/components/admin/payments/commission-editor";
import { LedgerTable } from "@/components/admin/payments/ledger-table";
import { PayoutBatches } from "@/components/admin/payments/payout-batches";
import { PromoCodesPanel } from "@/components/admin/payments/promo-codes";
import { RefundsPanel } from "@/components/admin/payments/refunds-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/admin/ui/tabs";
import { endpoints, query } from "@/lib/admin/api/endpoints";
import { routeFatal } from "@/lib/admin/api/guard";
import { tryGetServer, tryListServer } from "@/lib/admin/api/server";
import type {
  CommissionRuleSet,
  LedgerEntry,
  PayoutBatch,
  PromoCode,
  RefundRequestRecord,
  SystemConfig,
} from "@/lib/admin/api/types";
import { CONFIG_KEYS } from "@/lib/admin/api/types";
import { can } from "@/lib/admin/rbac";
import { filterValues, pageQuery } from "@/lib/admin/url-query";

export const metadata: Metadata = { title: "Payments" };

const PER_PAGE = 25;

/**
 * Payments.
 *
 * Four concerns on one route rather than four routes, because they are read
 * together: an admin looking at a refund wants the ledger entry beside it, and
 * an admin changing a commission rule wants to see what the last payout batch
 * paid out under the old one.
 *
 * The whole route is already behind `finance` or `super_admin` in `proxy.ts`
 * and in the gateway. The `readOnly` flag below is belt and braces for the case
 * where a role is granted read access here later.
 */
export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [roles, params] = await Promise.all([adminRoles(), searchParams]);
  const readOnly = !can(roles, "finance");

  const page = Number.parseInt(params.page ?? "1", 10) || 1;
  const ledgerQuery = query({
    status: params.status,
    provider: params.provider,
    from: params.from,
    to: params.to,
    page,
    per_page: PER_PAGE,
  });

  const [ledger, rules, batches, refunds, promos] = await Promise.all([
    tryListServer<LedgerEntry>(endpoints.finance.ledger(ledgerQuery)),
    tryGetServer<SystemConfig<CommissionRuleSet>>(endpoints.finance.commissionRules()),
    tryListServer<PayoutBatch>(endpoints.finance.payoutBatches(query({ per_page: 10 }))),
    tryListServer<RefundRequestRecord>(endpoints.finance.refunds(query({ per_page: 25 }))),
    tryListServer<PromoCode>(endpoints.finance.promoCodes(query({ per_page: 50, include_inactive: true }))),
  ]);

  const filters = [
    {
      name: "status",
      label: "Status",
      kind: "select" as const,
      options: [
        { value: "succeeded", label: "Succeeded" },
        { value: "failed", label: "Failed" },
        { value: "refunded", label: "Refunded" },
      ],
    },
    {
      name: "provider",
      label: "Provider",
      kind: "select" as const,
      options: [
        { value: "stripe", label: "Stripe" },
        { value: "payhere", label: "PayHere" },
        { value: "dialog", label: "Dialog carrier billing" },
      ],
    },
    { name: "from", label: "From", kind: "date" as const },
    { name: "to", label: "To", kind: "date" as const },
  ];

  const filtered = Boolean(params.status || params.provider || params.from || params.to);

  return (
    <>
      <PageHeader
        title="Payments"
        description="Ledger, commission policy, payout batches, refunds and promo codes. All amounts are integer cents on the wire; the currency is carried separately and never inferred."
      />

      <Tabs defaultValue="ledger">
        <TabsList>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="commission">Commission rules</TabsTrigger>
          <TabsTrigger value="payouts">Payout batches</TabsTrigger>
          <TabsTrigger value="refunds">Refunds</TabsTrigger>
          <TabsTrigger value="promos">Promo codes</TabsTrigger>
        </TabsList>

        <TabsContent value="ledger">
          <FilterBar
            filters={filters}
            legend="Filter the payment ledger"
            values={filterValues(params, filters)}
          />
          {ledger.ok ? (
            <>
              <LedgerTable
                entries={ledger.page.data}
                filtered={filtered}
                exportQuery={ledgerQuery.toString()}
              />
              <Pagination
                meta={ledger.page.meta}
                label="Payment ledger"
                query={pageQuery(params)}
              />
            </>
          ) : (
            <ErrorState error={routeFatal(ledger.error)} what="the payment ledger" />
          )}
        </TabsContent>

        <TabsContent value="commission">
          {rules.ok ? (
            <CommissionEditor config={rules.data} readOnly={readOnly} />
          ) : rules.error.code === "NOT_FOUND" ? (
            <CommissionEditor
              config={{
                key: CONFIG_KEYS.commissionRules,
                value: { default_commission_percent: 0, rules: [] },
                version: 0,
                updated_by: null,
                effective_from: new Date(0).toISOString(),
                created_at: new Date(0).toISOString(),
              }}
              readOnly={readOnly}
            />
          ) : (
            <ErrorState error={rules.error} what="the commission rules" />
          )}
        </TabsContent>

        <TabsContent value="payouts">
          {batches.ok || batches.error.code === "NOT_FOUND" ? (
            <PayoutBatches
              batches={batches.ok ? batches.page.data : []}
              readOnly={readOnly}
            />
          ) : (
            <ErrorState error={batches.error} what="payout batches" />
          )}
        </TabsContent>

        <TabsContent value="refunds">
          {refunds.ok || refunds.error.code === "NOT_FOUND" ? (
            <RefundsPanel
              refunds={refunds.ok ? refunds.page.data : []}
              readOnly={readOnly}
            />
          ) : (
            <ErrorState error={refunds.error} what="refund requests" />
          )}
        </TabsContent>

        <TabsContent value="promos">
          {promos.ok || promos.error.code === "NOT_FOUND" ? (
            <PromoCodesPanel codes={promos.ok ? promos.page.data : []} readOnly={readOnly} />
          ) : (
            <ErrorState error={promos.error} what="promo codes" />
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
