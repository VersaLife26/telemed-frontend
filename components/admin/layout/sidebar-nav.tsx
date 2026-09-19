"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ITEMS } from "./nav-items";
import { type RbacGroup, can } from "@/lib/admin/rbac";
import type { AdminRole } from "@/lib/admin/api/types";
import { cn } from "@/lib/admin/utils";

/**
 * Primary navigation.
 *
 * Items the caller's role cannot use are not rendered — the same matrix the
 * gateway enforces, mirrored in `lib/rbac.ts`. Hiding them is a courtesy, not
 * a control: the backend would refuse the request regardless.
 */
export function SidebarNav({
  roles,
  onNavigate,
}: {
  roles: readonly AdminRole[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const visible = NAV_ITEMS.filter((item) => can(roles, item.group as RbacGroup));

  return (
    <nav aria-label="Primary" className="flex flex-col gap-1 p-3">
      {visible.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm transition-[background-color,color,box-shadow] duration-[160ms] ease-out",
              active
                ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground shadow-sm ring-1 ring-blue-200/80"
                : "text-sidebar-foreground can-hover:hover:bg-sidebar-accent/70",
            )}
          >
            <item.icon
              className={cn(
                "mt-0.5 size-4 shrink-0 transition-opacity",
                active ? "text-primary" : "opacity-70",
              )}
              aria-hidden="true"
            />
            <span className="flex flex-col">
              <span>{item.label}</span>
              <span
                className={cn(
                  "text-xs font-normal",
                  active ? "text-sidebar-accent-foreground/75" : "text-muted-foreground",
                )}
              >
                {item.description}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
