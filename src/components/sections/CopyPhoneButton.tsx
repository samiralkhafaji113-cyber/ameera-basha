"use client";

import { Copy } from "lucide-react";
import { ar } from "@/content/ar";
import { site } from "@/lib/site";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export function CopyPhoneButton() {
  const toast = useToast();
  return (
    <Button
      variant="ghost"
      size="sm"
      icon={<Copy className="size-4" aria-hidden="true" />}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(site.phone.display);
          toast.show(ar.contact.copied);
        } catch {
          toast.show("تعذّر النسخ. الرقم: " + site.phone.display, "error");
        }
      }}
    >
      {ar.contact.copy}
    </Button>
  );
}
