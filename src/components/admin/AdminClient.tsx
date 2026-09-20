"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import type { ActionResult } from "@/lib/actions";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

/** Runs a Server Action, shows its Arabic message as a toast and refreshes the server data on success. */
export function useRunAction() {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  function run<T>(fn: () => Promise<ActionResult<T>>, opts: { onDone?: (r: ActionResult<T>) => void; refresh?: boolean } = {}) {
    start(async () => {
      let result: ActionResult<T>;
      try {
        result = await fn();
      } catch {
        result = { ok: false, message: "تعذّر الاتصال بالخادم. حاول مرة أخرى." };
      }
      toast.show(result.message ?? (result.ok ? "تم." : "فشلت العملية."), result.ok ? "success" : "error");
      if (result.ok && opts.refresh !== false) router.refresh();
      opts.onDone?.(result);
    });
  }
  return { run, pending };
}

/** Confirmation before destructive/visible changes. Rendered only while open so lists stay light. */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  danger,
  busy,
  onConfirm,
  onClose,
  children,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="ghost" onClick={onClose} data-autofocus>
            إلغاء
          </Button>
          <Button variant={danger ? "primary" : "primary"} className={danger ? "!bg-error hover:!bg-error/90" : undefined} disabled={busy} onClick={onConfirm}>
            {busy ? "جاري التنفيذ…" : confirmLabel}
          </Button>
        </div>
      }
    >
      {children ?? <p className="text-sm text-muted">تأكد من رغبتك في المتابعة.</p>}
    </Modal>
  );
}

/** "New reservations" without websockets: re-fetch the server data every minute while the tab is visible, or on demand. */
export function AutoRefresh({ everySeconds = 60 }: { everySeconds?: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = window.setInterval(tick, everySeconds * 1000);
    return () => window.clearInterval(id);
  }, [router, everySeconds]);
  return (
    <button
      type="button"
      onClick={() => start(() => router.refresh())}
      disabled={pending}
      className="inline-flex min-h-10 items-center gap-2 rounded-md border border-line bg-surface px-3 text-sm font-semibold text-text transition-colors hover:border-primary hover:bg-surface-warm disabled:opacity-60"
    >
      <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} aria-hidden="true" />
      تحديث
    </button>
  );
}
