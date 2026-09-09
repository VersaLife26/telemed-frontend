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
import { Badge } from "@/components/admin/ui/badge";
import type { DoctorUtilisationRow } from "@/lib/admin/api/types";
import { formatCount, formatPercent, shortId } from "@/lib/admin/format";

/**
 * Doctor utilisation, as a table rather than a chart.
 *
 * The question this answers — "which doctors are carrying the load, and which
 * have a no-show problem" — is a lookup across four numbers per doctor. A
 * grouped bar chart with forty groups answers it worse than a sorted table.
 */
export function UtilisationTable({ rows }: { rows: DoctorUtilisationRow[] }) {
  const sorted = [...rows].sort((a, b) => b.total_count - a.total_count).slice(0, 20);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Doctor utilisation</CardTitle>
        <CardDescription>
          The twenty busiest doctors in this range, by total appointments.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <EmptyState
            title="No appointments in this range"
            description="Utilisation is derived from the appointment projection; nothing has been recorded for these dates."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doctor</TableHead>
                <TableHead className="text-right">Completed</TableHead>
                <TableHead className="text-right">Cancelled</TableHead>
                <TableHead className="text-right">No-show</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">No-show rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((row) => {
                const rate = row.total_count > 0 ? row.no_show_count / row.total_count : 0;
                return (
                  <TableRow key={row.doctor_id}>
                    <TableCell>
                      <span className="font-medium">{row.doctor_name ?? "Unnamed"}</span>
                      <span
                        className="ml-2 font-mono text-xs text-muted-foreground"
                        title={row.doctor_id}
                      >
                        {shortId(row.doctor_id)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCount(row.completed_count)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCount(row.cancelled_count)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCount(row.no_show_count)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCount(row.total_count)}
                    </TableCell>
                    <TableCell className="text-right">
                      {rate > 0.2 ? (
                        <Badge variant="warning">{formatPercent(rate)}</Badge>
                      ) : (
                        <span className="tabular-nums">{formatPercent(rate)}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
