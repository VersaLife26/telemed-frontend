"use client";

import type { LucideIcon } from "lucide-react";
import { Ellipsis } from "lucide-react";
import { LayoutGroup, MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { useId, useState } from "react";

import { cx } from "@/lib/consumer/cx";
import { springSnappy } from "@/lib/consumer/motion";

import { Modal } from "./Modal";
import { isActivePath } from "./NavBar";

export type TabBarItem = { href: string; label: string; icon: LucideIcon };

/**
 * Mobile glass tab bar. At most five slots: past that the labels stop fitting
 * a 360px screen, so the rest go behind a "More" slot that opens a sheet.
 */
export function TabBar({
  items,
  pathname,
  overflow = [],
  className,
}: {
  items: ReadonlyArray<TabBarItem>;
  pathname: string;
  overflow?: ReadonlyArray<TabBarItem>;
  className?: string;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const groupId = useId();
  const overflowActive = overflow.some((item) => isActivePath(pathname, item.href));

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup id={groupId}>
        <nav
          aria-label="Primary"
          className={cx("tab-bar fixed inset-x-0 bottom-0 z-40 md:hidden", className)}
        >
          <ul
            className="grid"
            style={{ gridTemplateColumns: `repeat(${items.length + (overflow.length ? 1 : 0)}, minmax(0, 1fr))` }}
          >
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActivePath(pathname, item.href) ? "page" : undefined}
                  className="flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 transition-[scale] duration-[var(--dur-press)] ease-out active:scale-[0.94]"
                >
                  <TabGlyph icon={item.icon} label={item.label} active={isActivePath(pathname, item.href)} />
                </Link>
              </li>
            ))}
            {overflow.length ? (
              <li>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={moreOpen}
                  onClick={() => setMoreOpen(true)}
                  className="flex min-h-14 w-full cursor-pointer flex-col items-center justify-center gap-0.5 px-1 transition-[scale] duration-[var(--dur-press)] ease-out active:scale-[0.94]"
                >
                  <TabGlyph icon={Ellipsis} label="More" active={overflowActive} />
                </button>
              </li>
            ) : null}
          </ul>
        </nav>

        {overflow.length ? (
          <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
            <ul className="-mx-2 flex flex-col">
              {overflow.map((item) => {
                const Icon = item.icon;
                const active = isActivePath(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "flex min-h-12 items-center gap-3 rounded-md px-2 text-body font-medium",
                        "transition-[background-color,color,scale] duration-[var(--dur-press)] ease-out active:scale-[0.98] can-hover:hover:bg-tint",
                        active ? "text-brand" : "text-ink",
                      )}
                    >
                      <Icon aria-hidden="true" className="size-5" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Modal>
        ) : null}
      </LayoutGroup>
    </MotionConfig>
  );
}

function TabGlyph({ icon: Icon, label, active }: { icon: LucideIcon; label: string; active: boolean }) {
  return (
    <>
      <span className="relative flex h-7 w-12 items-center justify-center">
        {active ? (
          <motion.span
            layoutId="tab-bar-active"
            transition={springSnappy}
            aria-hidden="true"
            className="absolute inset-0 rounded-pill bg-brand"
          />
        ) : null}
        <Icon
          aria-hidden="true"
          className={cx(
            "relative size-5 transition-colors duration-[var(--dur-fast)] ease-out",
            active ? "text-on-brand" : "text-muted",
          )}
          strokeWidth={active ? 2.4 : 1.8}
        />
      </span>
      <span
        className={cx(
          "text-[11px] font-medium tracking-[0.01em] transition-colors duration-[var(--dur-fast)] ease-out",
          active ? "text-brand" : "text-muted",
        )}
      >
        {label}
      </span>
    </>
  );
}
