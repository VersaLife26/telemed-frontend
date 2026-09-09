import { CheckCircle2, Clock, XCircle } from "lucide-react";

import { Badge } from "@/components/admin/ui/badge";
import type { VerificationStatus } from "@/lib/admin/api/types";

/** Status carried by an icon and a word, never by colour alone. */
export function VerificationStatusBadge({ status }: { status: VerificationStatus }) {
  switch (status) {
    case "approved":
      return (
        <Badge variant="success">
          <CheckCircle2 className="size-3" aria-hidden="true" />
          Approved
        </Badge>
      );
    case "rejected":
      return (
        <Badge variant="destructive">
          <XCircle className="size-3" aria-hidden="true" />
          Rejected
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="warning">
          <Clock className="size-3" aria-hidden="true" />
          Pending
        </Badge>
      );
  }
}
