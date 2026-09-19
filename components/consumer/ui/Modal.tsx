"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";

import { cx } from "@/lib/consumer/cx";

/**
 * A frosted confirmation dialog, on a native <dialog>.
 *
 * `showModal()` gives the focus trap, the Escape key, the inert background and
 * ::backdrop for free -- all of which a div-based dialog has to reimplement,
 * and usually gets slightly wrong. The enter/exit animation lives in
 * styles/consumer.css under `.vl-modal`.
 *
 * Unlike a popover, this is not anchored to its trigger, so it keeps the
 * default centred transform-origin.
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
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

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
      <div className={cx("glass-panel-strong p-6", className)}>
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-h4 text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-m-2 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-faint transition-[background-color,color,transform] duration-[160ms] ease-out active:scale-[0.94] can-hover:hover:bg-tint can-hover:hover:text-ink"
          >
            <X className="size-4.5" />
          </button>
        </div>

        {description ? <p className="mt-2 text-body text-muted">{description}</p> : null}
        {children ? <div className="mt-4 text-body text-muted">{children}</div> : null}
        {footer ? <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div> : null}
      </div>
    </dialog>
  );
}
