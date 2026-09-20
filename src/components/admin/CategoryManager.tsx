"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createCategoryAction,
  createSubcategoryAction,
  deleteCategoryAction,
  deleteSubcategoryAction,
  reorderCategoriesAction,
  setCategoryActiveAction,
  updateCategoryAction,
  updateSubcategoryAction,
} from "@/app/admin/actions/categories";
import type { CategoryFormState } from "@/app/admin/actions/categories";
import { ConfirmDialog, useRunAction } from "@/components/admin/AdminClient";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { prepareForUpload, uploadErrorMessage } from "@/lib/media/client-compress";
import { useRouter } from "next/navigation";

export interface AdminCategory {
  id: string;
  slug: string;
  name: string;
  short_name: string | null;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  products: { count: number }[];
  subcategories: { id: string; slug: string; name: string; is_active: boolean; sort_order: number; products: { count: number }[] }[];
}

const iconBtn = "grid size-11 place-items-center md:size-10 rounded-md border border-line bg-surface transition-colors hover:border-primary hover:bg-surface-warm disabled:opacity-40";

function CategoryFormModal({ category, onClose }: { category?: AdminCategory; onClose: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const action = category ? updateCategoryAction.bind(null, category.id) : createCategoryAction;
  const [state, formAction, pending] = useActionState<CategoryFormState, FormData>(action, null);
  const done = useRef(false);
  useEffect(() => {
    if (state?.ok && !done.current) {
      done.current = true;
      toast.show(state.message ?? "تم الحفظ.");
      router.refresh();
      onClose();
    }
  }, [state, toast, router, onClose]);
  const errors = state && !state.ok ? (state.errors ?? {}) : {};
  return (
    <Modal
      open
      onClose={onClose}
      title={category ? "تعديل القسم" : "إضافة قسم"}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" form="category-form" disabled={pending}>
            {pending ? "جاري الحفظ…" : "حفظ"}
          </Button>
        </div>
      }
    >
      <form id="category-form" action={formAction} className="flex flex-col gap-4" noValidate>
        {state && !state.ok && (
          <p role="alert" className="rounded-md border border-error/30 bg-error-bg p-3 text-sm font-semibold text-error">
            {state.message}
          </p>
        )}
        <Field label="اسم القسم" required error={errors.name}>
          {(a) => <Input id={a.id} name="name" defaultValue={category?.name} maxLength={80} data-autofocus aria-invalid={a.invalid} aria-describedby={a.describedBy} />}
        </Field>
        <Field label="اسم مختصر" optionalLabel="(للفلاتر)" error={errors.short_name}>
          {(a) => <Input id={a.id} name="short_name" defaultValue={category?.short_name ?? ""} maxLength={40} aria-describedby={a.describedBy} />}
        </Field>
        <Field label="وصف" optionalLabel="(اختياري)" error={errors.description}>
          {(a) => <Textarea id={a.id} name="description" defaultValue={category?.description ?? ""} rows={3} maxLength={300} aria-describedby={a.describedBy} />}
        </Field>
        <Field label="الرابط المختصر" optionalLabel="(اختياري)" hint="أحرف إنجليزية وأرقام وشرطات. تغييره يغيّر روابط التصفية." error={errors.slug}>
          {(a) => <Input id={a.id} name="slug" defaultValue={category?.slug} dir="ltr" className="text-end" maxLength={60} aria-invalid={a.invalid} aria-describedby={a.describedBy} />}
        </Field>
        <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
          <input type="checkbox" name="is_active" defaultChecked={category?.is_active ?? true} className="size-5 accent-primary" />
          القسم فعّال (يظهر في الموقع)
        </label>
      </form>
    </Modal>
  );
}

function SubcategoryRow({ sub }: { sub: AdminCategory["subcategories"][number] }) {
  const { run, pending } = useRunAction();
  const [name, setName] = useState(sub.name);
  const [confirm, setConfirm] = useState(false);
  const count = sub.products[0]?.count ?? 0;
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-md border border-line-soft bg-surface-warm p-2">
      <label className="sr-only" htmlFor={`sub-${sub.id}`}>
        اسم القسم الفرعي
      </label>
      <input id={`sub-${sub.id}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="h-10 min-w-0 flex-1 rounded-md border border-line bg-surface px-3 text-sm" />
      <span className="text-xs text-muted tabular-nums">{count} منتج</span>
      <label className="flex items-center gap-1.5 text-xs font-semibold">
        <input type="checkbox" checked={sub.is_active} disabled={pending} onChange={(e) => run(() => updateSubcategoryAction(sub.id, name, e.target.checked))} className="size-4 accent-primary" />
        فعّال
      </label>
      <Button size="sm" variant="secondary" className="!h-10" disabled={pending || name.trim() === sub.name} onClick={() => run(() => updateSubcategoryAction(sub.id, name, sub.is_active))}>
        حفظ
      </Button>
      <button type="button" aria-label={`حذف ${sub.name}`} className={`${iconBtn} text-error`} disabled={pending} onClick={() => setConfirm(true)}>
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
      {confirm && (
        <ConfirmDialog danger title="حذف القسم الفرعي؟" description={count ? `يحتوي هذا القسم على ${count} منتج، ولا يمكن حذفه قبل نقلها.` : `سيُحذف «${sub.name}».`} confirmLabel="حذف" busy={pending} onClose={() => setConfirm(false)} onConfirm={() => run(() => deleteSubcategoryAction(sub.id), { onDone: () => setConfirm(false) })} />
      )}
    </li>
  );
}

function AddSubcategory({ categoryId }: { categoryId: string }) {
  const toast = useToast();
  const router = useRouter();
  const [state, action, pending] = useActionState<CategoryFormState, FormData>(createSubcategoryAction.bind(null, categoryId), null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state) return;
    toast.show(state.message ?? (state.ok ? "تم." : "فشلت العملية."), state.ok ? "success" : "error");
    if (state.ok) {
      form.current?.reset();
      router.refresh();
    }
    // toast/router are stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <form ref={form} action={action} className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`new-sub-${categoryId}`}>
        اسم قسم فرعي جديد
      </label>
      <input id={`new-sub-${categoryId}`} name="name" required maxLength={80} placeholder="قسم فرعي جديد" className="h-10 min-w-0 flex-1 rounded-md border border-line bg-surface px-3 text-sm" />
      <input type="hidden" name="is_active" value="on" />
      <Button type="submit" size="sm" variant="secondary" className="!h-10" disabled={pending} icon={<Plus className="size-4" aria-hidden="true" />}>
        إضافة
      </Button>
    </form>
  );
}

export function CategoryManager({ categories }: { categories: AdminCategory[] }) {
  const { run, pending } = useRunAction();
  const toast = useToast();
  const router = useRouter();
  const [editing, setEditing] = useState<AdminCategory | "new" | null>(null);
  const [deleting, setDeleting] = useState<AdminCategory | null>(null);
  const [busyImage, setBusyImage] = useState<string | null>(null);

  const move = (i: number, delta: -1 | 1) => {
    const to = i + delta;
    if (to < 0 || to >= categories.length) return;
    const ids = categories.map((c) => c.id);
    [ids[i], ids[to]] = [ids[to], ids[i]];
    run(() => reorderCategoriesAction(ids));
  };

  async function uploadCover(id: string, file: File) {
    setBusyImage(id);
    const body = new FormData();
    body.set("file", await prepareForUpload(file));
    body.set("target", "category");
    body.set("id", id);
    try {
      const res = await fetch("/api/admin/media", { method: "POST", body });
      if (!res.ok) throw new Error(await uploadErrorMessage(res));
      toast.show("تم تغيير صورة القسم.");
      router.refresh();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "تعذّر رفع الصورة.", "error");
    } finally {
      setBusyImage(null);
    }
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button size="sm" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setEditing("new")}>
          إضافة قسم
        </Button>
      </div>

      <ul className="flex flex-col gap-4">
        {categories.map((c, i) => {
          const productCount = c.products[0]?.count ?? 0;
          return (
            <li key={c.id} className="rounded-lg border border-line-soft bg-surface p-4 shadow-card">
              <div className="flex flex-wrap items-start gap-4">
                <div className="relative size-24 shrink-0 overflow-hidden rounded-md bg-surface-sand">
                  {c.image_url ? <Image src={c.image_url} alt="" fill sizes="96px" className="object-cover" /> : <span className="grid size-full place-items-center text-xs text-muted">بلا صورة</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="!text-lg">{c.name}</h3>
                    <Badge tone={c.is_active ? "success" : "neutral"}>{c.is_active ? "فعّال" : "معطّل"}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    <bdi dir="ltr">{c.slug}</bdi> · {productCount} منتج
                  </p>
                  {c.description && <p className="mt-1 text-sm text-muted">{c.description}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" aria-label={`تقديم ${c.name}`} className={iconBtn} disabled={i === 0 || pending} onClick={() => move(i, -1)}>
                    <ChevronUp className="size-4" aria-hidden="true" />
                  </button>
                  <button type="button" aria-label={`تأخير ${c.name}`} className={iconBtn} disabled={i === categories.length - 1 || pending} onClick={() => move(i, 1)}>
                    <ChevronDown className="size-4" aria-hidden="true" />
                  </button>
                  <label className={`${iconBtn} cursor-pointer`} title="تغيير الصورة">
                    <ImagePlus className="size-4" aria-hidden="true" />
                    <span className="sr-only">تغيير صورة {c.name}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      className="sr-only"
                      disabled={busyImage === c.id}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void uploadCover(c.id, f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <button type="button" aria-label={`تعديل ${c.name}`} className={iconBtn} onClick={() => setEditing(c)}>
                    <Pencil className="size-4" aria-hidden="true" />
                  </button>
                  <button type="button" className="inline-flex h-10 items-center rounded-md border border-line px-3 text-sm font-semibold hover:bg-surface-sand disabled:opacity-50" disabled={pending} onClick={() => run(() => setCategoryActiveAction(c.id, !c.is_active))}>
                    {c.is_active ? "تعطيل" : "تفعيل"}
                  </button>
                  <button type="button" aria-label={`حذف ${c.name}`} className={`${iconBtn} text-error`} onClick={() => setDeleting(c)}>
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <details className="mt-4 border-t border-line-soft pt-3">
                <summary className="min-h-10 cursor-pointer text-sm font-semibold">الأقسام الفرعية ({c.subcategories.length})</summary>
                <ul className="mt-3 flex flex-col gap-2">
                  {[...c.subcategories].sort((a, b) => a.sort_order - b.sort_order).map((s) => (
                    <SubcategoryRow key={s.id} sub={s} />
                  ))}
                </ul>
                <div className="mt-3">
                  <AddSubcategory categoryId={c.id} />
                </div>
              </details>
            </li>
          );
        })}
      </ul>

      {editing && <CategoryFormModal category={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog
          danger
          title="حذف القسم؟"
          description={
            (deleting.products[0]?.count ?? 0) > 0
              ? `يحتوي القسم «${deleting.name}» على ${deleting.products[0].count} منتج. لا يمكن حذفه قبل نقل منتجاته إلى قسم آخر (يمكنك تعطيله بدل ذلك).`
              : `سيُحذف القسم «${deleting.name}» نهائياً.`
          }
          confirmLabel="حذف القسم"
          busy={pending}
          onClose={() => setDeleting(null)}
          onConfirm={() => run(() => deleteCategoryAction(deleting.id), { onDone: () => setDeleting(null) })}
        />
      )}
    </>
  );
}
