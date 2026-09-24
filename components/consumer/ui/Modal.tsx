"use client";

import { X } from "lucide-react";
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef } from "react";

import { cx } from "@/lib/consumer/cx";
import { project, rubberband, spring, springFlick } from "@/lib/consumer/motion";

/**
 * A frosted dialog, on a native <dialog>.
 *
 * `showModal()` gives the focus trap, the Escape key, the inert background and
 * ::backdrop for free -- all of which a div-based dialog has to reimplement,
 * and usually gets slightly wrong. The enter/exit animation lives in
 * styles/consumer.css under `.vl-modal`.
 *
 * Below 640px the same element is a bottom sheet. The CSS moves the <dialog>
 * in and out; a drag moves the panel inside it, so a drag never has to undo
 * a transition that is still running.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const reduceMotion = useReducedMotion();
  const y = useMotionValue(0);
  const drag = useRef<{ pointerId: number; startY: number; origin: number } | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      y.jump(0);
      dialog.showModal();
    } else if (!open && dialog.open) dialog.close();
  }, [open, y]);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    y.stop();
    drag.current = { pointerId: event.pointerId, startY: event.clientY, origin: y.get() };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.pointerId !== event.pointerId) return;
    const next = d.origin + event.clientY - d.startY;
    const height = panelRef.current?.offsetHeight ?? window.innerHeight;
    y.set(next < 0 ? rubberband(next, height) : next);
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.pointerId !== event.pointerId) return;
    drag.current = null;
    const height = panelRef.current?.offsetHeight ?? window.innerHeight;
    const velocity = y.getVelocity();
    const resting = y.get() + project(velocity);
    if (y.get() > 0 && (resting > height * 0.5 || velocity > 1000)) {
      if (reduceMotion) {
        onClose();
        return;
      }
      animate(y, height, { ...spring, velocity }).then(onClose);
    } else {
      animate(y, 0, { ...springFlick, velocity });
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Escape and a backdrop click both route through the same handler, so
      // the parent's state cannot drift out of sync with the element's.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // The dialog element itself is the backdrop hit area. The panel inside
      // it carries the padding, so a click on the gap around the panel closes
      // the dialog and a click on the panel's own padding does not.
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="vl-modal"
    >
      <motion.div
        ref={panelRef}
        style={{ y }}
        className={cx(
          "glass-panel-strong p-6",
          "max-sm:max-h-[calc(100dvh-1.5rem)] max-sm:overflow-y-auto max-sm:overscroll-contain max-sm:rounded-b-none max-sm:rounded-t-xl max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))] max-sm:pt-0",
          className,
        )}
      >
        <div
          className="vl-sheet-handle max-sm:-mx-6 max-sm:px-6 max-sm:pt-2"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div aria-hidden="true" className="mx-auto mb-3 h-1.5 w-10 rounded-pill bg-ink-300/70 sm:hidden" />
          <div className="flex items-start justify-between gap-4">
            <h2 id={titleId} className="text-h4 text-ink">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-m-3 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-faint transition-[background-color,color,scale] duration-[var(--dur-press)] ease-out active:scale-[0.94] can-hover:hover:bg-tint can-hover:hover:text-ink"
            >
              <X className="size-4.5" />
            </button>
          </div>
        </div>

        {description ? <p className="mt-2 text-body text-muted">{description}</p> : null}
        {children ? <div className="mt-4 text-body text-muted">{children}</div> : null}
        {footer ? <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div> : null}
      </motion.div>
    </dialog>
  );
}
