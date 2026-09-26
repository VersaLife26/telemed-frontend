import type { Metadata } from "next";

import { ErrorState } from "@/components/admin/common/error-state";
import { PageHeader } from "@/components/admin/common/page-header";
import { FilterBar } from "@/components/admin/data-table/filter-bar";
import { Pagination } from "@/components/admin/data-table/pagination";
import { CommissionView } from "@/components/admin/payments/commission-view";
import { LedgerTable } from "@/components/admin/payments/ledger-table";
import { PayoutBatches } from "@/components/admin/payments/payout-batches";
import { PromoCodesPanel } from "@/components/admin/payments/promo-codes";
import { RefundsPanel } from "@/components/admin/payments/refunds-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/admin/ui/tabs";
import { endpoints, query } from "@/lib/admin/api/endpoints";
import { routeFatal } from "@/lib/admin/api/guard";
import { tryGetServer, tryListServer } from "@/lib/admin/api/server";
import type {
  AdminRefund,
  Commission,
  LedgerPage,
  PayoutBatch,
  PromoCode,
} from "@/lib/admin/api/types";
import { filterValues, pageQuery } from "@/lib/admin/url-query";

export const metadata: Metadata = { title: "Payments" };

const PER_PAGE = 25;

/**
 * Payments.
 *
 * Several concerns on one route rather than several routes, because they are
 * read together: an admin looking at a refund wants the ledger entry beside it.
 * The whole route is behind the `finance` permission.
 */
export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;

  const page = Number.parseInt(params.page ?? "1", 10) || 1;
  const exportFilter = {
    from: params.from,
    to: params.to,
    doctorId: params.doctorId,
  };
  const ledgerQuery = query({ ...exportFilter, page, pageSize: PER_PAGE });

  const [ledger, commission, batches, refunds, promos] = await Promise.all([
    tryGetServer<LedgerPage>(endpoints.finance.ledger(ledgerQuery)),
    tryGetServer<Commission>(endpoints.finance.commission()),
    tryListServer<PayoutBatch>(endpoints.finance.payoutBatches(query({ pageSize: 10 }))),
    tryListServer<AdminRefund>(endpoints.finance.refunds(query({ pageSize: 25 }))),
    tryListServer<PromoCode>(endpoints.finance.promoCodes(query({ pageSize: 50 }))),
  ]);

  const filters = [
    { name: "from", label: "From", kind: "date" as const },
    { name: "to", label: "To", kind: "date" as const },
    {
      name: "doctorId",
      label: "Doctor ID",
      kind: "search" as const,
      placeholder: "Doctor UUID",
    },
  ];

  const filtered = Boolean(params.from || params.to || params.doctorId);

  return (
    <>
      <PageHeader
        title="Payments"
        description="Ledger, commission policy, payout batches, refunds and promo codes. All amounts are integer cents on the wire; the currency is carried separately and never inferred."
      />

      <Tabs defaultValue="ledger">
        <TabsList>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="commission">Commission</TabsTrigger>
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
                entries={ledger.data.items}
                totals={ledger.data.totals}
                filtered={filtered}
                exportQuery={query(exportFilter).toString()}
              />
              <Pagination
                meta={ledger.data}
                label="Payment ledger"
                query={pageQuery(params)}
              />
            </>
          ) : (
            <ErrorState error={routeFatal(ledger.error)} what="the payment ledger" />
          )}
        </TabsContent>

        <TabsContent value="commission">
          {commission.ok ? (
            <CommissionView commission={commission.data} />
          ) : (
            <ErrorState error={commission.error} what="the commission policy" />
          )}
        </TabsContent>

        <TabsContent value="payouts">
          {batches.ok ? (
            <PayoutBatches batches={batches.page.items} />
          ) : (
            <ErrorState error={batches.error} what="payout batches" />
          )}
        </TabsContent>

        <TabsContent value="refunds">
          {refunds.ok ? (
            <RefundsPanel refunds={refunds.page.items} />
          ) : (
            <ErrorState error={refunds.error} what="refunds" />
          )}
        </TabsContent>

        <TabsContent value="promos">
          {promos.ok ? (
            <PromoCodesPanel codes={promos.page.items} />
          ) : (
            <ErrorState error={promos.error} what="promo codes" />
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
