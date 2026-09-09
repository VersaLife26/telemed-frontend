import { Badge } from "@/components/admin/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/admin/ui/table";
import type { PermissionMatrix } from "@/lib/admin/api/types";

const ROLE_LABELS: Record<string, string> = {
  support: "Support",
  ops: "Ops",
  finance: "Finance",
  admin: "Admin",
  super_admin: "Super admin",
};

/**
 * What each role can reach, rendered from the matrix admin-service actually
 * enforces rather than from this app's own copy in lib/rbac.ts.
 *
 * That copy still exists and is still correct — middleware needs a synchronous
 * answer at the edge and cannot await a fetch. But it is a second
 * hand-maintained transcription of an authorization table, and this grid is
 * read by someone deciding what a colleague should be able to do. If the two
 * ever disagree, the screen used to make the decision should be the one
 * telling the truth.
 */
export function PermissionGrid({ matrix }: { matrix: PermissionMatrix }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-64">Area</TableHead>
            {matrix.roles.map((role) => (
              <TableHead key={role} className="text-center whitespace-nowrap">
                {ROLE_LABELS[role] ?? role}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {matrix.groups.map((group) => (
            <TableRow key={group.group}>
              <TableCell className="align-top">
                <div className="font-medium">{group.label}</div>
                <p className="text-muted-foreground mt-1 text-sm">{group.detail}</p>
              </TableCell>
              {matrix.roles.map((role) => {
                const allowed = group.roles.includes(role);
                return (
                  <TableCell key={role} className="text-center align-top">
                    <span
                      aria-label={
                        allowed
                          ? `${ROLE_LABELS[role] ?? role} can access ${group.label}`
                          : `${ROLE_LABELS[role] ?? role} cannot access ${group.label}`
                      }
                      className={
                        allowed
                          ? "text-foreground font-semibold"
                          : "text-muted-foreground/40"
                      }
                    >
                      {allowed ? "yes" : "—"}
                    </span>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
          <TableRow>
            <TableCell className="align-top">
              <div className="font-medium">Patient medical records</div>
              <p className="text-muted-foreground mt-1 text-sm">
                Documents, prescriptions, clinical notes and call recordings.
                Denied to every admin role, including super admin — enforced in
                record-service and consultation-service, not merely omitted
                here. Staff see that a record exists, never what is in it.
              </p>
            </TableCell>
            {matrix.roles.map((role) => (
              <TableCell key={role} className="text-center align-top">
                <Badge variant="outline" className="font-normal">
                  never
                </Badge>
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
