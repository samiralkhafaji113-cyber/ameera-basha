"use client";

import { useActionState, useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { changePasswordAction, confirmPricesCurrencyAction } from "@/app/admin/actions/settings";
import { ConfirmDialog, useRunAction } from "@/components/admin/AdminClient";
import { Card } from "@/components/admin/AdminUi";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import type { ActionResult } from "@/lib/actions";

export function ConfirmPricesPanel({ unverified }: { unverified: number }) {
  const { run, pending } = useRunAction();
  const [currency, setCurrency] = useState<"IQD" | "USD" | null>(null);
  const label = { IQD: "الدينار العراقي (IQD)", USD: "الدولار الأمريكي (USD)" } as const;
  return (
    <Card title="تأكيد عملة الأسعار المستوردة">
      <p className="text-sm leading-7 text-muted">
        الأسعار المأخوذة من منشورات تيليغرام لا تذكر عملتها صراحةً، لذلك لا تُعرض للزوار (يظهر «السعر عند الاستفسار»). إذا أكّدت أن كل هذه الأسعار بعملة واحدة، يمكنك تأكيدها دفعة واحدة. يمكن تعديل أي منتج على حدة لاحقاً.
      </p>
      <p className="mt-3 text-sm font-semibold">
        عدد المنتجات ذات الأسعار غير المؤكدة: <span className="tabular-nums text-accent-text">{unverified}</span>
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" size="sm" disabled={pending || unverified === 0} onClick={() => setCurrency("IQD")}>
          تأكيدها كدينار عراقي
        </Button>
        <Button variant="secondary" size="sm" disabled={pending || unverified === 0} onClick={() => setCurrency("USD")}>
          تأكيدها كدولار
        </Button>
      </div>
      {currency && (
        <ConfirmDialog
          title="تأكيد الأسعار؟"
          description={`سيتم اعتماد أسعار ${unverified} منتج بعملة ${label[currency]} وإظهارها للزوار. هذا يؤثر مباشرة على الموقع العام.`}
          confirmLabel="نعم، أكّد الأسعار"
          busy={pending}
          onClose={() => setCurrency(null)}
          onConfirm={() => run((): Promise<ActionResult<{ updated: number }>> => confirmPricesCurrencyAction(currency), { onDone: () => setCurrency(null) })}
        />
      )}
    </Card>
  );
}

export function ChangePasswordPanel() {
  const toast = useToast();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(changePasswordAction, null);
  useEffect(() => {
    if (state) toast.show(state.message ?? (state.ok ? "تم." : "فشلت العملية."), state.ok ? "success" : "error");
    // toast is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  const errors = state && !state.ok ? (state.errors ?? {}) : {};
  return (
    <Card title="تغيير كلمة المرور">
      <form action={action} className="flex max-w-sm flex-col gap-4" noValidate>
        <Field label="كلمة المرور الجديدة" required error={errors.password} hint="10 أحرف على الأقل، وتحتوي حرفاً كبيراً وصغيراً ورقماً.">
          {(a) => <Input id={a.id} name="password" type="password" autoComplete="new-password" dir="ltr" className="text-end" aria-invalid={a.invalid} aria-describedby={a.describedBy} />}
        </Field>
        <Field label="تأكيد كلمة المرور" required error={errors.confirm}>
          {(a) => <Input id={a.id} name="confirm" type="password" autoComplete="new-password" dir="ltr" className="text-end" aria-invalid={a.invalid} aria-describedby={a.describedBy} />}
        </Field>
        <Button type="submit" size="sm" disabled={pending} icon={<KeyRound className="size-4" aria-hidden="true" />} className="self-start">
          {pending ? "جاري الحفظ…" : "تغيير كلمة المرور"}
        </Button>
      </form>
    </Card>
  );
}
