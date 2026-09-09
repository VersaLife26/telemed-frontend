import { Building2 } from "lucide-react";

import { Badge } from "@/components/admin/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
import { EmptyState } from "@/components/admin/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/admin/ui/table";
import type { CorporateClient, SystemConfig } from "@/lib/admin/api/types";
import { formatCount, formatDateTime, formatPercent } from "@/lib/admin/format";

/**
 * Corporate clients (AIA, Airtel and similar).
 *
 * Read-only here, deliberately. A corporate agreement is a contract with a
 * negotiated discount and an employee roster; onboarding one is a commercial
 * process, not a form. The console shows what is configured so an admin can
 * answer "is this employee covered" without opening a spreadsheet, and stops
 * there.
 */
export function CorporateClientsCard({
  config,
}: {
  config: SystemConfig<CorporateClient[]>;
}) {
  const clients = config.value ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Corporate clients</CardTitle>
        <CardDescription>
          Version {config.version}, effective {formatDateTime(config.effective_from)}.
          Read-only: corporate agreements are onboarded through the commercial process,
          not through this console.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {clients.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No corporate clients configured"
            description="Corporate cover is configured at the system_configs key corporate_clients."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">Covered employees</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {client.contact_email ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCount(client.covered_employee_count)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPercent(client.discount_percent / 100, 0)}
                  </TableCell>
                  <TableCell>
                    {client.active ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="muted">Inactive</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
