"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/consumer/ui/Button";
import { browserApi } from "@/lib/consumer/api/client";
import { ApiError } from "@/lib/consumer/api/envelope";
import { noShowPath } from "@/lib/consumer/features/consult";

export function MarkNoShowButton({
  appointmentId,
  afterHref,
}: {
  appointmentId: string;
  afterHref?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mark() {
    if (!window.confirm("Mark this patient as a no-show? The visit will close.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await browserApi(noShowPath(appointmentId), { method: "POST" });
      if (afterHref) {
        router.replace(afterHref);
      } else {
        router.refresh();
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("This visit is already closed.");
      } else {
        setError(err instanceof Error ? err.message : "Could not mark no-show");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        fullWidth={false}
        disabled={busy}
        onClick={() => void mark()}
      >
        {busy ? "Marking…" : "Mark no-show"}
      </Button>
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
    </div>
  );
}
