"use client";

import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { ar } from "@/content/ar";

/**
 * Accessible modal built on the native <dialog>: focus is trapped, Esc closes, the page behind is
 * inert and focus returns to the trigger on close – no extra focus-trap dependency needed.
 *
 * Layout slots (header → scrollable body → sticky footer with safe-area padding) follow the 21st.dev
 * "Modal" / "Drawer" patterns; on phones it becomes a bottom sheet (see `dialog.sheet` in globals.css).
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // Land on the first field instead of the close button.
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // click on the backdrop
      }}
      className="sheet m-auto max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-xl overflow-hidden rounded-lg bg-surface p-0 text-text shadow-pop"
    >
      <div className="flex max-h-[92dvh] flex-col">
        <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 rounded-full bg-line sm:hidden" />
        <div className="flex items-start justify-between gap-4 px-5 pt-3 pb-3 sm:px-6 sm:pt-5">
          <div className="min-w-0">
            <h2 id={titleId} className="!text-xl sm:!text-2xl">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-sm leading-6 text-muted">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={ar.reservation.close}
            className="grid size-11 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-sand hover:text-text"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-line-soft px-5 py-5 sm:px-6">{children}</div>
        {footer && (
          <div className="border-t border-line-soft bg-surface-warm px-5 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] sm:px-6 sm:pb-4">
            {footer}
          </div>
        )}
      </div>
    </dialog>
  );
}
