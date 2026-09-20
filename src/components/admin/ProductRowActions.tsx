"use client";

import Link from "next/link";
import { useState } from "react";
import { Archive, Eye, EyeOff, Pencil, RotateCcw, Star, Trash2, Undo2 } from "lucide-react";
import { purgeProductAction, restoreProductAction, setFeaturedAction, setProductStatusAction, trashProductAction } from "@/app/admin/actions/products";
import { ConfirmDialog, useRunAction } from "@/components/admin/AdminClient";
import { can } from "@/lib/auth/roles";
import type { Role } from "@/lib/auth/roles";
import { cn } from "@/lib/cn";
import type { ProductStatus } from "@/lib/validation/product";

const btn =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-line bg-surface px-3 text-sm md:min-h-10 font-semibold text-text transition-colors hover:border-primary hover:bg-surface-warm disabled:pointer-events-none disabled:opacity-55";

type Pending = null | "archive" | "trash" | "purge";

export function ProductRowActions({
  id,
  name,
  status,
  featured,
  trashed,
  role,
  hideEdit,
  compact,
}: {
  id: string;
  name: string;
  status: ProductStatus;
  featured: boolean;
  trashed: boolean;
  role: Role;
  /** on the edit page itself the «edit» link would point to the current page */
  hideEdit?: boolean;
  /** icon-only buttons (table rows): the text stays available to screen readers and as a tooltip */
  compact?: boolean;
}) {
  const { run, pending } = useRunAction();
  const [confirm, setConfirm] = useState<Pending>(null);
  const canPublish = can(role, "products.publish");
  const canDelete = can(role, "products.delete");
  const canPurge = can(role, "products.purge");
  const box = compact ? "!px-0 min-w-11 md:min-w-10" : "";
  const label = (text: string) => <span className={compact ? "sr-only" : undefined}>{text}</span>;
  const tip = (text: string) => (compact ? { title: text } : {});
  const set = (to: ProductStatus) => run(() => setProductStatusAction(id, to));

  if (trashed) {
    return (
      <div className={cn("flex gap-2", compact ? "flex-nowrap" : "flex-wrap")}>
        {canDelete && (
          <button type="button" className={cn(btn, box)} disabled={pending} onClick={() => run(() => restoreProductAction(id))} {...tip("استعادة")}>
            <Undo2 className="size-4" aria-hidden="true" />
            {label("استعادة")}
          </button>
        )}
        {canPurge && (
          <button type="button" className={cn(btn, box, "text-error hover:border-error hover:bg-error-bg")} disabled={pending} onClick={() => setConfirm("purge")} {...tip("حذف نهائي")}>
            <Trash2 className="size-4" aria-hidden="true" />
            {label("حذف نهائي")}
          </button>
        )}
        {confirm === "purge" && (
          <ConfirmDialog
            danger
            title="حذف المنتج نهائياً؟"
            description={`سيتم حذف «${name}» وجميع صوره من التخزين ولا يمكن التراجع عن ذلك.`}
            confirmLabel="نعم، احذف نهائياً"
            busy={pending}
            onClose={() => setConfirm(null)}
            onConfirm={() => run(() => purgeProductAction(id), { onDone: () => setConfirm(null) })}
          />
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex gap-2", compact ? "flex-nowrap" : "flex-wrap")}>
      {!hideEdit && (
        <Link href={`/admin/products/${id}/edit`} className={cn(btn, box)} {...tip("تعديل")}>
          <Pencil className="size-4" aria-hidden="true" />
          {label("تعديل")}
        </Link>
      )}
      {canPublish && status === "published" && (
        <button type="button" className={cn(btn, box)} disabled={pending} onClick={() => set("hidden")} {...tip("إخفاء")}>
          <EyeOff className="size-4" aria-hidden="true" />
          {label("إخفاء")}
        </button>
      )}
      {canPublish && (status === "hidden" || status === "draft" || status === "archived") && (
        <button type="button" className={cn(btn, box)} disabled={pending} onClick={() => set("published")} {...tip("نشر")}>
          <Eye className="size-4" aria-hidden="true" />
          {label("نشر")}
        </button>
      )}
      {canPublish && status !== "archived" && (
        <button type="button" className={cn(btn, box)} disabled={pending} onClick={() => setConfirm("archive")} {...tip("أرشفة")}>
          <Archive className="size-4" aria-hidden="true" />
          {label("أرشفة")}
        </button>
      )}
      {canPublish && status === "archived" && (
        <button type="button" className={cn(btn, box)} disabled={pending} onClick={() => set("draft")} {...tip("استعادة كمسودة")}>
          <RotateCcw className="size-4" aria-hidden="true" />
          {label("استعادة")}
        </button>
      )}
      {canPublish && status === "published" && (
        <button
          type="button"
          className={cn(btn, box, featured && "border-accent bg-surface-sand text-accent-text")}
          aria-pressed={featured}
          disabled={pending}
          onClick={() => run(() => setFeaturedAction(id, !featured))}
          {...tip(featured ? "إلغاء التمييز" : "تمييز")}
        >
          <Star className={cn("size-4", featured && "fill-current")} aria-hidden="true" />
          {label(featured ? "مميز" : "تمييز")}
        </button>
      )}
      {canDelete && (
        <button type="button" className={cn(btn, box, "text-error hover:border-error hover:bg-error-bg")} disabled={pending} onClick={() => setConfirm("trash")} {...tip("حذف")}>
          <Trash2 className="size-4" aria-hidden="true" />
          {label("حذف")}
        </button>
      )}

      {confirm === "archive" && (
        <ConfirmDialog
          title="أرشفة المنتج؟"
          description={`«${name}» سيختفي من الموقع ويُحفظ في الأرشيف، ويمكن استعادته لاحقاً.`}
          confirmLabel="أرشفة"
          busy={pending}
          onClose={() => setConfirm(null)}
          onConfirm={() => run(() => setProductStatusAction(id, "archived"), { onDone: () => setConfirm(null) })}
        />
      )}
      {confirm === "trash" && (
        <ConfirmDialog
          danger
          title="حذف المنتج؟"
          description={`سيُنقل «${name}» إلى المحذوفات ويختفي من الموقع. صوره تبقى محفوظة ويمكن استعادته لاحقاً؛ الحذف النهائي (بما فيه الصور) متاح للمدير من قسم المحذوفات.`}
          confirmLabel="نقل إلى المحذوفات"
          busy={pending}
          onClose={() => setConfirm(null)}
          onConfirm={() => run(() => trashProductAction(id), { onDone: () => setConfirm(null) })}
        />
      )}
    </div>
  );
}
