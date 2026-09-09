"use client";

import { signOut } from "next-auth/react";
import { LogOut, ShieldCheck } from "lucide-react";

import { Button } from "@/components/admin/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu";
import type { AdminRole } from "@/lib/admin/api/types";
import { roleLabel } from "@/lib/admin/rbac";

export function UserMenu({
  name,
  email,
  roles,
}: {
  name: string;
  email: string;
  roles: readonly AdminRole[];
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 gap-2 px-2"
          aria-label={`Account menu for ${name}`}
        >
          <span
            aria-hidden="true"
            className="flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground"
          >
            {initials || "?"}
          </span>
          <span className="hidden max-w-40 truncate text-sm sm:inline">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Signed in as</DropdownMenuLabel>
        <div className="px-2 pb-2">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Roles</DropdownMenuLabel>
        <div className="flex flex-wrap gap-1 px-2 pb-2">
          {roles.length === 0 ? (
            <span className="text-xs text-muted-foreground">None</span>
          ) : (
            roles.map((role) => (
              <span
                key={role}
                className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-xs"
              >
                <ShieldCheck className="size-3" aria-hidden="true" />
                {roleLabel(role)}
              </span>
            ))
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut({ redirectTo: "/login?reason=signed-out" })}>
          <LogOut className="size-4" aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
