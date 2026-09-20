"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Save } from "lucide-react";
import { createProductAction, updateProductAction } from "@/app/admin/actions/products";
import type { ProductFormState } from "@/app/admin/actions/products";
import { Card } from "@/components/admin/AdminUi";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { LETTER_SIZES, PRODUCT_SOURCES } from "@/lib/validation/product";

export interface CategoryOption {
  id: string;
  name: string;
  subcategories: { id: string; name: string }[];
}

export interface ProductFormValues {
  name: string;
  slug: string;
  category_id: string;
  subcategory_id: string;
  description: string;
  price: string;
  currency: string;
  price_verified: boolean;
  available: string;
  featured: boolean;
  sizes: string[];
  numeric_sizes: string;
  size_label: string;
  age_min: string;
  age_max: string;
  source: string;
  source_url: string;
  source_post_id: string;
  source_published_at: string;
}

export const EMPTY_PRODUCT: ProductFormValues = {
  name: "",
  slug: "",
  category_id: "",
  subcategory_id: "",
  description: "",
  price: "",
  currency: "",
  price_verified: false,
  available: "",
  featured: false,
  sizes: [],
  numeric_sizes: "",
  size_label: "",
  age_min: "",
  age_max: "",
  source: "manual",
  source_url: "",
  source_post_id: "",
  source_published_at: "",
};

const SOURCE_LABEL: Record<string, string> = { manual: "إدخال يدوي", telegram: "Telegram", facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok" };
const SIZE_LABEL: Record<string, string> = { FREE: "فري سايز" };

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card title={title}>
      {hint && <p className="-mt-2 mb-4 text-sm text-muted">{hint}</p>}
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

export function ProductForm({
  categories,
  initial = EMPTY_PRODUCT,
  productId,
  canPublish,
}: {
  categories: CategoryOption[];
  initial?: ProductFormValues;
  /** set when editing */
  productId?: string;
  canPublish: boolean;
}) {
  const toast = useToast();
  const [values, setValues] = useState<ProductFormValues>(initial);
  const action = useMemo(() => (productId ? updateProductAction.bind(null, productId) : createProductAction), [productId]);
  const [state, formAction, pending] = useActionState<ProductFormState, FormData>(action, null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const errors = state && !state.ok ? (state.errors ?? {}) : {};
  const failed = state && !state.ok;

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.show(state.message ?? "تم الحفظ.");
    else summaryRef.current?.focus();
    // toast is a stable context value; only react to new results
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const set = <K extends keyof ProductFormValues>(k: K, v: ProductFormValues[K]) => setValues((s) => ({ ...s, [k]: v }));
  const text = (k: keyof ProductFormValues) => ({ name: k, value: values[k] as string, onChange: (e: { target: { value: string } }) => set(k, e.target.value as never) });
  const subs = categories.find((c) => c.id === values.category_id)?.subcategories ?? [];
  const toggleSize = (s: string) => set("sizes", values.sizes.includes(s) ? values.sizes.filter((x) => x !== s) : [...values.sizes, s]);

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {failed && (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="rounded-md border border-error/30 bg-error-bg p-4 text-sm font-semibold text-error outline-offset-4">
          {state.message}
        </div>
      )}

      <Section title="المعلومات الأساسية">
        <Field label="اسم المنتج" required error={errors.name} className="sm:col-span-2">
          {(a) => <Input id={a.id} {...text("name")} maxLength={160} aria-invalid={a.invalid} aria-describedby={a.describedBy} aria-required="true" data-autofocus />}
        </Field>
        <Field label="القسم" required error={errors.category_id}>
          {(a) => (
            <Select
              id={a.id}
              name="category_id"
              value={values.category_id}
              onChange={(e) => setValues((s) => ({ ...s, category_id: e.target.value, subcategory_id: "" }))}
              aria-invalid={a.invalid}
              aria-describedby={a.describedBy}
              aria-required="true"
            >
              <option value="">اختر القسم</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="القسم الفرعي" optionalLabel="(اختياري)" error={errors.subcategory_id}>
          {(a) => (
            <Select id={a.id} {...text("subcategory_id")} disabled={subs.length === 0} aria-describedby={a.describedBy}>
              <option value="">بدون</option>
              {subs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="الوصف" optionalLabel="(اختياري)" error={errors.description} className="sm:col-span-2">
          {(a) => <Textarea id={a.id} {...text("description")} rows={4} maxLength={2000} aria-describedby={a.describedBy} aria-invalid={a.invalid} />}
        </Field>
        <Field label="الرابط المختصر (Slug)" optionalLabel="(اختياري)" hint="أحرف إنجليزية وأرقام وشرطات. يُولَّد تلقائياً إن تُرك فارغاً. تغييره يغيّر رابط الصفحة." error={errors.slug} className="sm:col-span-2">
          {(a) => <Input id={a.id} {...text("slug")} dir="ltr" className="text-end" maxLength={80} placeholder="summer-dress-01" aria-invalid={a.invalid} aria-describedby={a.describedBy} />}
        </Field>
      </Section>

      <Section title="السعر والتوفر" hint="لا يظهر السعر للزوار إلا إذا كان مؤكداً ومعه عملة؛ وإلا يظهر «السعر عند الاستفسار».">
        <Field label="السعر" optionalLabel="(اختياري)" error={errors.price}>
          {(a) => <Input id={a.id} {...text("price")} inputMode="decimal" dir="ltr" className="text-end" placeholder="0" aria-invalid={a.invalid} aria-describedby={a.describedBy} />}
        </Field>
        <Field label="العملة" error={errors.currency}>
          {(a) => (
            <Select id={a.id} {...text("currency")} aria-invalid={a.invalid} aria-describedby={a.describedBy}>
              <option value="">غير محددة</option>
              <option value="IQD">دينار عراقي (IQD)</option>
              <option value="USD">دولار أمريكي (USD)</option>
            </Select>
          )}
        </Field>
        <label className="flex min-h-11 items-center gap-3 rounded-md border border-line-soft bg-surface-warm px-3 text-sm font-semibold sm:col-span-2">
          <input type="checkbox" name="price_verified" checked={values.price_verified} onChange={(e) => set("price_verified", e.target.checked)} className="size-5 accent-primary" />
          السعر مؤكد (يظهر للزوار)
          {errors.price_verified && <span className="text-error"> – {errors.price_verified}</span>}
        </label>
        <Field label="التوفر" hint="«غير معروف» لا يعرض أي معلومة عن التوفر للزوار.">
          {(a) => (
            <Select id={a.id} {...text("available")} aria-describedby={a.describedBy}>
              <option value="">غير معروف</option>
              <option value="true">متوفر</option>
              <option value="false">غير متوفر</option>
            </Select>
          )}
        </Field>
        {canPublish && (
          <label className="flex min-h-11 items-center gap-3 self-end rounded-md border border-line-soft bg-surface-warm px-3 text-sm font-semibold">
            <input type="checkbox" name="featured" checked={values.featured} onChange={(e) => set("featured", e.target.checked)} className="size-5 accent-primary" />
            منتج مميز (يظهر في الصفحة الرئيسية)
          </label>
        )}
      </Section>

      <Section title="الفئة العمرية والمقاسات">
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-semibold">المقاسات (حروف)</legend>
          <div className="flex flex-wrap gap-2">
            {LETTER_SIZES.map((s) => {
              const on = values.sizes.includes(s);
              return (
                <label key={s} className={`inline-flex h-11 min-w-14 cursor-pointer items-center justify-center rounded-full border px-4 text-sm font-semibold transition-colors ${on ? "border-primary bg-primary text-on-primary" : "border-line bg-surface hover:border-primary"}`}>
                  <input type="checkbox" name="sizes" value={s} checked={on} onChange={() => toggleSize(s)} className="sr-only" />
                  {SIZE_LABEL[s] ?? s}
                </label>
              );
            })}
          </div>
          {errors.sizes && <p className="mt-1 text-sm font-medium text-error">{errors.sizes}</p>}
        </fieldset>
        <Field label="مقاسات رقمية" optionalLabel="(اختياري)" hint="أرقام مفصولة بفواصل: 38, 40, 42" error={errors.numeric_sizes}>
          {(a) => <Input id={a.id} {...text("numeric_sizes")} dir="ltr" className="text-end" aria-invalid={a.invalid} aria-describedby={a.describedBy} />}
        </Field>
        <Field label="نص المقاس كما هو" optionalLabel="(اختياري)" hint="مثال: من 38 إلى 48" error={errors.size_label}>
          {(a) => <Input id={a.id} {...text("size_label")} maxLength={120} aria-invalid={a.invalid} aria-describedby={a.describedBy} />}
        </Field>
        <Field label="العمر من (سنة)" optionalLabel="(اختياري)" error={errors.age_min}>
          {(a) => <Input id={a.id} {...text("age_min")} inputMode="decimal" dir="ltr" className="text-end" aria-invalid={a.invalid} aria-describedby={a.describedBy} />}
        </Field>
        <Field label="العمر إلى (سنة)" optionalLabel="(اختياري)" error={errors.age_max}>
          {(a) => <Input id={a.id} {...text("age_max")} inputMode="decimal" dir="ltr" className="text-end" aria-invalid={a.invalid} aria-describedby={a.describedBy} />}
        </Field>
      </Section>

      <Section title="المصدر" hint="من أين أُخذ هذا المنتج. المنتجات المُدخلة يدوياً لا تعرض شارة مصدر للزوار.">
        <Field label="المصدر" error={errors.source}>
          {(a) => (
            <Select id={a.id} {...text("source")} aria-describedby={a.describedBy}>
              {PRODUCT_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABEL[s]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="تاريخ المنشور الأصلي" optionalLabel="(اختياري)" error={errors.source_published_at}>
          {(a) => <Input id={a.id} {...text("source_published_at")} type="date" dir="ltr" className="text-end" aria-invalid={a.invalid} aria-describedby={a.describedBy} />}
        </Field>
        <Field label="رابط المنشور" optionalLabel="(اختياري)" error={errors.source_url} className="sm:col-span-2">
          {(a) => <Input id={a.id} {...text("source_url")} type="url" dir="ltr" className="text-end" placeholder="https://" aria-invalid={a.invalid} aria-describedby={a.describedBy} />}
        </Field>
        <Field label="معرّف المنشور" optionalLabel="(اختياري)" error={errors.source_post_id}>
          {(a) => <Input id={a.id} {...text("source_post_id")} dir="ltr" className="text-end" aria-invalid={a.invalid} aria-describedby={a.describedBy} />}
        </Field>
      </Section>

      <div className="sticky bottom-0 z-10 -mx-4 flex justify-end gap-3 border-t border-line-soft bg-surface/95 px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <Button type="submit" size="lg" disabled={pending} icon={<Save className="size-5" aria-hidden="true" />}>
          {pending ? "جاري الحفظ…" : productId ? "حفظ التعديلات" : "إنشاء المنتج"}
        </Button>
      </div>
    </form>
  );
}
