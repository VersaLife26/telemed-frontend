"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/consumer/layout/AppShell";
import { Button } from "@/components/consumer/ui/Button";
import { browserApi } from "@/lib/consumer/api/client";
import type { TelemedUser } from "@/lib/consumer/api/types";

export default function ProfilePage() {
  const [user, setUser] = useState<TelemedUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    browserApi<TelemedUser>("/users/me")
      .then(setUser)
      .catch((e) => setError(e instanceof Error ? e.message : "Sign in required"))
      .finally(() => setLoading(false));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  if (loading) {
    return <p className="text-body text-text-muted">Loading profile…</p>;
  }

  if (error || !user) {
    return (
      <Card className="flex flex-col gap-4">
        <p className="text-body text-text-muted">{error || "Sign in to view your profile."}</p>
        <Link href="/login" className="max-w-xs">
          <Button>Sign in</Button>
        </Link>
      </Card>
    );
  }

  return (
    <Card className="flex max-w-xl flex-col gap-4">
      <h1 className="text-h4 text-black">Profile</h1>
      <dl className="grid gap-3 text-body">
        <div>
          <dt className="text-text-label">Name</dt>
          <dd>{user.name || "—"}</dd>
        </div>
        <div>
          <dt className="text-text-label">Phone</dt>
          <dd>{user.phone}</dd>
        </div>
        <div>
          <dt className="text-text-label">Role</dt>
          <dd>{user.role || "patient"}</dd>
        </div>
      </dl>
      <Button type="button" variant="outline" onClick={() => void logout()}>
        Sign out
      </Button>
    </Card>
  );
}
