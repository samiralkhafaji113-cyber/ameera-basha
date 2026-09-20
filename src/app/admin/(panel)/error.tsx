"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/States";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <ErrorState title="تعذّر تحميل الصفحة" text="حدث خطأ غير متوقع أثناء جلب البيانات. جرّب مرة أخرى.">
      <Button onClick={reset}>إعادة المحاولة</Button>
    </ErrorState>
  );
}
