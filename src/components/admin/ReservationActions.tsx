"use client";

import { useState } from "react";
import { MessageCircle, Save } from "lucide-react";
import { saveReservationNotesAction, setReservationStatusAction } from "@/app/admin/actions/reservations";
import { ConfirmDialog, useRunAction } from "@/components/admin/AdminClient";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { ACTION_LABEL, STATUS_LABEL, nextStatuses } from "@/lib/reservation-status";
import type { ReservationStatus } from "@/lib/reservation-status";

/** Only the moves the state machine allows are offered (the database enforces the same rules). */
export function ReservationActions({ id, status, whatsappHref, initialNotes }: { id: string; status: ReservationStatus; whatsappHref: string; initialNotes: string }) {
  const { run, pending } = useRunAction();
  const [confirm, setConfirm] = useState<ReservationStatus | null>(null);
  const [notes, setNotes] = useState(initialNotes);
  const moves = nextStatuses(status);
  const needsConfirm = (s: ReservationStatus) => s === "cancelled" || s === "rejected";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-3 !font-sans !text-sm !font-semibold text-muted">تغيير الحالة</h3>
        <div className="flex flex-wrap gap-2">
          {moves.length === 0 && <p className="text-sm text-muted">الحجز «{STATUS_LABEL[status]}» ولا توجد إجراءات إضافية.</p>}
          {moves.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={s === "cancelled" || s === "rejected" ? "secondary" : s === "pending" ? "secondary" : "primary"}
              disabled={pending}
              onClick={() => (needsConfirm(s) ? setConfirm(s) : run(() => setReservationStatusAction(id, s)))}
            >
              {ACTION_LABEL[s]}
            </Button>
          ))}
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-whatsapp px-4 text-sm font-semibold text-white transition-colors hover:bg-whatsapp-hover"
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            فتح واتساب
            <span className="sr-only"> – يفتح في نافذة جديدة، ولا تُرسل الرسالة تلقائياً</span>
          </a>
        </div>
      </div>

      <div>
        <label htmlFor="admin-notes" className="mb-2 block text-sm font-semibold">
          ملاحظات داخلية <span className="font-normal text-muted">(لا تظهر للعميل)</span>
        </label>
        <Textarea id="admin-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={1000} />
        <Button className="mt-2" size="sm" variant="secondary" disabled={pending || notes === initialNotes} icon={<Save className="size-4" aria-hidden="true" />} onClick={() => run(() => saveReservationNotesAction(id, notes))}>
          حفظ الملاحظات
        </Button>
      </div>

      {confirm && (
        <ConfirmDialog
          danger
          title={confirm === "cancelled" ? "إلغاء الحجز؟" : "رفض الحجز؟"}
          description="ستتغير حالة الحجز ويُسجَّل ذلك في السجل. يمكن إعادة فتح الحجز لاحقاً."
          confirmLabel={ACTION_LABEL[confirm]}
          busy={pending}
          onClose={() => setConfirm(null)}
          onConfirm={() => run(() => setReservationStatusAction(id, confirm), { onDone: () => setConfirm(null) })}
        />
      )}
    </div>
  );
}
