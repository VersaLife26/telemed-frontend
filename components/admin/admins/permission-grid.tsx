import { Badge } from "@/components/admin/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/admin/ui/table";
import {
  ASSIGNABLE_ADMIN_ROLES,
  type AdminPermission,
  type PermissionRoles,
} from "@/lib/admin/api/types";

const ROLE_LABELS: Record<string, string> = {
  support: "Support",
  ops: "Ops",
  finance: "Finance",
  admin: "Admin",
  superAdmin: "Super admin",
};

const PERMISSION_LABELS: Record<AdminPermission, { label: string; detail: string }> = {
  credentialing: { label: "Credentialing", detail: "Review and decide doctor applications." },
  doctors: { label: "Doctors", detail: "Approved doctors, their schedules, holidays and slot blocks." },
  users: { label: "Users", detail: "Search, suspend and reinstate patients and doctors." },
  appointments: { label: "Appointments", detail: "All bookings, cancellations and reschedule requests." },
  content: { label: "Content", detail: "Specialties and the drug formulary." },
  disputes: { label: "Disputes", detail: "Patient complaints and refund mediation." },
  analytics: { label: "Analytics", detail: "The dashboard." },
  audit: { label: "Audit log", detail: "Read the record of admin actions." },
  finance: { label: "Finance", detail: "Ledger, payouts, refunds and promo codes." },
  auditExport: { label: "Audit export", detail: "Download the whole audit trail as CSV." },
  adminUsers: { label: "Admin accounts", detail: "Create admins and change their roles." },
};

/**
 * What each role can reach, rendered from the matrix the API actually
 * enforces (`GET /admin/permissions`) rather than from this app's own copy in
 * lib/rbac.ts.
 *
 * That copy still exists and is still correct — the nav needs an answer
 * without a second fetch. But it is a second
 * hand-maintained transcription of an authorization table, and this grid is
 * read by someone deciding what a colleague should be able to do. If the two
 * ever disagree, the screen used to make the decision should be the one
 * telling the truth.
 */
export function PermissionGrid({ matrix }: { matrix: PermissionRoles[] }) {
  const roles = ASSIGNABLE_ADMIN_ROLES;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-64">Area</TableHead>
            {roles.map((role) => (
              <TableHead key={role} className="text-center whitespace-nowrap">
                {ROLE_LABELS[role]}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {matrix.map((group) => (
            <TableRow key={group.permission}>
              <TableCell className="align-top">
                <div className="font-medium">{PERMISSION_LABELS[group.permission].label}</div>
                <p className="text-muted-foreground mt-1 text-sm">
                  {PERMISSION_LABELS[group.permission].detail}
                </p>
              </TableCell>
              {roles.map((role) => {
                const allowed = group.roles.includes(role);
                return (
                  <TableCell key={role} className="text-center align-top">
                    <span
                      aria-label={
                        allowed
                          ? `${ROLE_LABELS[role]} can access ${PERMISSION_LABELS[group.permission].label}`
                          : `${ROLE_LABELS[role]} cannot access ${PERMISSION_LABELS[group.permission].label}`
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
                Documents, prescriptions and clinical notes. Denied to every
                admin role, including super admin — enforced by the API, not
                merely omitted here. Staff see that a record exists, never what is in it.
              </p>
            </TableCell>
            {roles.map((role) => (
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
