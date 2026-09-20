"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { CircleCheck, Copy, MessageCircle, TriangleAlert } from "lucide-react";
import { ar } from "@/content/ar";
import { site } from "@/lib/site";
import { sizeOptions } from "@/lib/product";
import { IRAQI_GOVERNORATES, buildReservationMessage, validateReservation } from "@/lib/reservation";
import { whatsappUrl } from "@/lib/whatsapp";
import { submitReservationAction } from "@/app/actions/reservation";
import type { ReservationErrors, ReservationField, ReservationRequest } from "@/lib/reservation";
import type { Product } from "@/types/product";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

const STORAGE_KEY = "ameera:customer";
type Saved = Partial<Record<"customerName" | "phone" | "governorate" | "district", string>>;

function loadSaved(): Saved {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : {};
  } catch {
    return {};
  }
}
function save(v: Saved) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  } catch {
    /* storage may be unavailable (private mode) – reservation still works */
  }
}

const FIELD_IDS: Record<ReservationField, string> = {
  customerName: "res-name",
  phone: "res-phone",
  governorate: "res-governorate",
  district: "res-district",
  quantity: "res-quantity",
};
const FIELD_LABELS: Record<ReservationField, string> = {
  customerName: ar.reservation.name,
  phone: ar.reservation.phone,
  governorate: ar.reservation.governorate,
  district: ar.reservation.district,
  quantity: ar.reservation.quantity,
};

export function ReservationDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const t = ar.reservation;
  const toast = useToast();
  const sizes = useMemo(() => sizeOptions(product), [product]);
  const summaryRef = useRef<HTMLDivElement>(null);

  const [saved] = useState(loadSaved);
  const [form, setForm] = useState({
    customerName: saved.customerName ?? "",
    phone: saved.phone ?? "",
    governorate: saved.governorate ?? "",
    district: saved.district ?? "",
    address: "",
    size: "",
    quantity: "1",
    notes: "",
    website: "", // honeypot – hidden from people
  });
  const [errors, setErrors] = useState<ReservationErrors>({});
  const [status, setStatus] = useState<"form" | "success" | "error">("form");
  const [busy, setBusy] = useState(false);
  const [reservationNumber, setReservationNumber] = useState<string>();
  const [serverMessage, setServerMessage] = useState<string>();

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const request = (): ReservationRequest => ({
    productId: product.id,
    productName: product.name,
    productUrl: product.sourceUrl,
    customerName: form.customerName,
    phone: form.phone,
    governorate: form.governorate,
    district: form.district,
    address: form.address.trim() || undefined,
    size: form.size.trim() || undefined,
    quantity: Number(form.quantity),
    notes: form.notes,
    reservationNumber,
  });

  const whatsappHref = () => whatsappUrl(site.phone.wa, buildReservationMessage(request()));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validateReservation({ ...form, quantity: Number(form.quantity) });
    setErrors(errs);
    if (Object.keys(errs).length) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setBusy(true);
    save({ customerName: form.customerName, phone: form.phone, governorate: form.governorate, district: form.district });
    // 1) Save the reservation in the database. 2) Only then offer WhatsApp. Nothing is sent automatically.
    try {
      const result = await submitReservationAction({
        productId: product.id,
        customerName: form.customerName,
        phone: form.phone,
        governorate: form.governorate,
        district: form.district,
        address: form.address,
        size: form.size,
        quantity: Number(form.quantity),
        notes: form.notes,
        website: form.website,
      });
      if (result.ok) {
        setReservationNumber(result.reservationNumber);
        setStatus("success");
      } else if (result.reason === "validation") {
        setErrors(result.errors);
        requestAnimationFrame(() => summaryRef.current?.focus());
      } else {
        setServerMessage(result.message);
        setStatus("error");
      }
    } catch {
      setServerMessage(t.errorText);
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }

  async function copyRequest() {
    try {
      await navigator.clipboard.writeText(buildReservationMessage(request()));
      toast.show(t.copied);
    } catch {
      toast.show("تعذّر النسخ، انسخ النص يدوياً.", "error");
    }
  }

  const errorEntries = (Object.keys(errors) as ReservationField[]).filter((k) => errors[k]);
  const cover = product.images[0];

  return (
    <Modal
      open
      onClose={onClose}
      title={status === "success" ? t.successTitle : status === "error" ? t.errorTitle : t.title}
      description={status === "form" ? t.intro : undefined}
      footer={
        status === "form" ? (
          // Sticky footer: the submit stays reachable on long forms / small screens. `form` links it to the <form> in the body.
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <Button variant="ghost" onClick={onClose}>
              {t.cancel}
            </Button>
            <Button
              type="submit"
              form="reservation-form"
              variant="whatsapp"
              size="lg"
              disabled={busy}
              icon={<MessageCircle className="size-5" aria-hidden="true" />}
            >
              {busy ? t.sending : t.submit}
            </Button>
          </div>
        ) : undefined
      }
    >
      {status === "success" && (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-success-bg text-success">
            <CircleCheck className="size-9" aria-hidden="true" />
          </span>
          {reservationNumber && (
            <p className="rounded-md border border-line-soft bg-surface-warm px-4 py-2 text-sm text-muted">
              {t.numberLabel}: <bdi className="font-bold tabular-nums text-text" dir="ltr">{reservationNumber}</bdi>
            </p>
          )}
          <p className="max-w-sm text-base leading-8">{t.successText}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <ButtonLink href={whatsappHref()} variant="whatsapp" icon={<MessageCircle className="size-5" aria-hidden="true" />}>
              {t.sendWhatsapp}
            </ButtonLink>
            <Button variant="secondary" onClick={onClose}>
              {t.close}
            </Button>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col items-center gap-4 py-4 text-center" role="alert">
          <span className="grid size-16 place-items-center rounded-full bg-error-bg text-error">
            <TriangleAlert className="size-9" aria-hidden="true" />
          </span>
          <p className="max-w-sm text-base leading-8">{serverMessage ?? t.errorText}</p>
          <p className="max-w-sm text-sm leading-7 text-muted">{t.notSavedNote}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <ButtonLink href={whatsappHref()} variant="whatsapp" icon={<MessageCircle className="size-5" aria-hidden="true" />}>
              {t.openWhatsapp}
            </ButtonLink>
            <Button variant="secondary" onClick={copyRequest} icon={<Copy className="size-5" aria-hidden="true" />}>
              {t.copyRequest}
            </Button>
          </div>
          <Button variant="ghost" onClick={() => setStatus("form")}>
            {t.backToForm}
          </Button>
        </div>
      )}

      {status === "form" && (
        <form id="reservation-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          <div className="flex items-center gap-3 rounded-md border border-line-soft bg-surface-warm p-3">
            {cover && (
              <Image src={cover.src} alt="" width={56} height={70} className="h-[70px] w-14 shrink-0 rounded object-cover" />
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-muted">{t.product}</p>
              <p className="truncate font-heading text-lg font-bold">{product.name}</p>
              {product.sizeLabel && <p className="text-xs text-muted">{product.sizeLabel}</p>}
            </div>
          </div>

          {errorEntries.length > 0 && (
            <div
              ref={summaryRef}
              tabIndex={-1}
              role="alert"
              className="rounded-md border border-error/30 bg-error-bg p-4 text-sm text-error outline-offset-4"
            >
              <p className="font-bold">{t.errorSummary}</p>
              <ul className="mt-1 list-disc ps-5">
                {errorEntries.map((k) => (
                  <li key={k}>
                    <a
                      href={`#${FIELD_IDS[k]}`}
                      className="font-semibold underline underline-offset-2"
                      onClick={(ev) => {
                        ev.preventDefault();
                        document.getElementById(FIELD_IDS[k])?.focus();
                      }}
                    >
                      {FIELD_LABELS[k]}
                    </a>
                    : {errors[k]}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={FIELD_IDS.customerName} label={t.name} required error={errors.customerName}>
              {(a) => (
                <Input
                  id={a.id}
                  name="name"
                  data-autofocus
                  autoComplete="name"
                  value={form.customerName}
                  onChange={set("customerName")}
                  aria-invalid={a.invalid}
                  aria-describedby={a.describedBy}
                  aria-required="true"
                />
              )}
            </Field>
            <Field id={FIELD_IDS.phone} label={t.phone} required error={errors.phone}>
              {(a) => (
                <Input
                  id={a.id}
                  name="tel"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  dir="ltr"
                  className="text-end"
                  placeholder="07xxxxxxxxx"
                  value={form.phone}
                  onChange={set("phone")}
                  aria-invalid={a.invalid}
                  aria-describedby={a.describedBy}
                  aria-required="true"
                />
              )}
            </Field>
            <Field id={FIELD_IDS.governorate} label={t.governorate} required error={errors.governorate}>
              {(a) => (
                <Select
                  id={a.id}
                  name="governorate"
                  value={form.governorate}
                  onChange={set("governorate")}
                  aria-invalid={a.invalid}
                  aria-describedby={a.describedBy}
                  aria-required="true"
                >
                  <option value="">{t.governoratePlaceholder}</option>
                  {IRAQI_GOVERNORATES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field id={FIELD_IDS.district} label={t.district} required error={errors.district}>
              {(a) => (
                <Input
                  id={a.id}
                  name="district"
                  autoComplete="address-level3"
                  value={form.district}
                  onChange={set("district")}
                  aria-invalid={a.invalid}
                  aria-describedby={a.describedBy}
                  aria-required="true"
                />
              )}
            </Field>
            <Field
              id="res-size"
              label={t.size}
              optionalLabel={t.optional}
              hint={product.sizeLabel ? `المتاح حسب المنشور: ${product.sizeLabel}` : undefined}
            >
              {(a) =>
                sizes.length > 0 ? (
                  <Select id={a.id} name="size" value={form.size} onChange={set("size")} aria-describedby={a.describedBy}>
                    <option value="">{t.sizePlaceholder}</option>
                    {sizes.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input id={a.id} name="size" value={form.size} onChange={set("size")} aria-describedby={a.describedBy} placeholder={t.sizeFree} />
                )
              }
            </Field>
            <Field id={FIELD_IDS.quantity} label={t.quantity} required error={errors.quantity}>
              {(a) => (
                <Input
                  id={a.id}
                  name="quantity"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={50}
                  value={form.quantity}
                  onChange={set("quantity")}
                  aria-invalid={a.invalid}
                  aria-describedby={a.describedBy}
                  aria-required="true"
                />
              )}
            </Field>
          </div>

          <Field id="res-address" label={t.address} optionalLabel={t.optional}>
            {(a) => <Input id={a.id} name="address" autoComplete="street-address" value={form.address} onChange={set("address")} placeholder={t.addressPlaceholder} />}
          </Field>

          {/* Honeypot: invisible to people and assistive tech; bots that fill it are rejected server-side. */}
          <div aria-hidden="true" className="sr-only">
            <label>
              Website
              <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
            </label>
          </div>

          <Field id="res-notes" label={t.notes} optionalLabel={t.optional}>
            {(a) => <Textarea id={a.id} name="notes" rows={3} value={form.notes} onChange={set("notes")} placeholder={t.notesPlaceholder} />}
          </Field>
        </form>
      )}
    </Modal>
  );
}
