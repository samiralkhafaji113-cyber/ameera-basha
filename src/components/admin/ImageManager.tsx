"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { DragEvent } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Star, Trash2, UploadCloud } from "lucide-react";
import { deleteImageAction, reorderImagesAction, setPrimaryImageAction, updateImageAltAction } from "@/app/admin/actions/products";
import { ConfirmDialog, useRunAction } from "@/components/admin/AdminClient";
import { Card } from "@/components/admin/AdminUi";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { prepareForUpload, uploadErrorMessage } from "@/lib/media/client-compress";
import { IMAGE_LIMITS } from "@/lib/validation/image";

export interface ManagedImage {
  id: string;
  public_url: string;
  alt_text: string | null;
  width: number | null;
  height: number | null;
  sort_order: number;
  is_primary: boolean;
  storage_path: string;
}

interface UploadItem {
  key: string;
  name: string;
  state: "uploading" | "error";
  message?: string;
}

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
const ALLOWED = ACCEPT.split(",");

const ordered = (imgs: ManagedImage[]) => [...imgs].sort((a, b) => a.sort_order - b.sort_order);

/**
 * Product images: multi-file upload (drag & drop or picker), live preview, reorder (drag or buttons), primary and delete.
 * Files are validated again on the server (magic bytes, size, dimensions) and re-encoded to WebP there.
 */
export function ImageManager({ productId, initial, published, canDelete }: { productId: string; initial: ManagedImage[]; published: boolean; canDelete: boolean }) {
  const toast = useToast();
  const { run, pending } = useRunAction();
  const [images, setImages] = useState<ManagedImage[]>(() => ordered(initial));
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ManagedImage | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const remaining = IMAGE_LIMITS.maxImagesPerProduct - images.length;

  async function uploadOne(file: File, key: string) {
    const body = new FormData();
    body.set("file", await prepareForUpload(file));
    body.set("target", "product");
    body.set("id", productId);
    try {
      const res = await fetch("/api/admin/media", { method: "POST", body });
      if (!res.ok) throw new Error(await uploadErrorMessage(res));
      const json = (await res.json()) as { ok: boolean; message?: string; image?: ManagedImage };
      if (!json.ok || !json.image) throw new Error(json.message ?? "فشل الرفع.");
      const image = json.image;
      setImages((prev) => ordered([...prev.map((i) => (image.is_primary ? { ...i, is_primary: false } : i)), image]));
      setUploads((u) => u.filter((x) => x.key !== key));
    } catch (e) {
      setUploads((u) => u.map((x) => (x.key === key ? { ...x, state: "error", message: e instanceof Error ? e.message : "فشل الرفع." } : x)));
    }
  }

  async function addFiles(list: FileList | File[]) {
    const files = Array.from(list);
    if (!files.length) return;
    if (files.length > remaining) toast.show(`يمكن إضافة ${Math.max(remaining, 0)} صورة فقط (الحد ${IMAGE_LIMITS.maxImagesPerProduct}).`, "error");
    const batch: { file: File; key: string }[] = [];
    const next: UploadItem[] = [];
    for (const file of files.slice(0, Math.max(remaining, 0))) {
      const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`;
      if (!ALLOWED.includes(file.type)) next.push({ key, name: file.name, state: "error", message: "نوع الملف غير مسموح (JPG / PNG / WebP / AVIF)." });
      else if (file.size > IMAGE_LIMITS.maxBytes) next.push({ key, name: file.name, state: "error", message: "الحجم أكبر من 8 ميغابايت." });
      else {
        next.push({ key, name: file.name, state: "uploading" });
        batch.push({ file, key });
      }
    }
    setUploads((u) => [...u, ...next]);
    // Sequential: keeps the order of selection as the order of images and is gentle on the server.
    for (const { file, key } of batch) await uploadOne(file, key);
  }

  function persistOrder(next: ManagedImage[], previous: ManagedImage[]) {
    setImages(next);
    run(() => reorderImagesAction(productId, next.map((i) => i.id)), {
      refresh: false,
      onDone: (r) => {
        if (!r.ok) setImages(previous);
      },
    });
  }

  function move(id: string, delta: -1 | 1) {
    const idx = images.findIndex((i) => i.id === id);
    const to = idx + delta;
    if (idx < 0 || to < 0 || to >= images.length) return;
    const copy = [...images];
    [copy[idx], copy[to]] = [copy[to], copy[idx]];
    persistOrder(copy.map((i, n) => ({ ...i, sort_order: n + 1 })), images);
  }

  function drop(e: DragEvent, targetId: string) {
    e.preventDefault();
    if (!dragId || dragId === targetId) return setDragId(null);
    const from = images.findIndex((i) => i.id === dragId);
    const to = images.findIndex((i) => i.id === targetId);
    setDragId(null);
    if (from < 0 || to < 0) return;
    const copy = [...images];
    const [moved] = copy.splice(from, 1);
    copy.splice(to, 0, moved);
    persistOrder(copy.map((i, n) => ({ ...i, sort_order: n + 1 })), images);
  }

  const makePrimary = (id: string) =>
    run(() => setPrimaryImageAction(id), {
      refresh: false,
      onDone: (r) => r.ok && setImages((prev) => prev.map((i) => ({ ...i, is_primary: i.id === id }))),
    });

  const remove = (img: ManagedImage) =>
    run(() => deleteImageAction(img.id), {
      refresh: false,
      onDone: (r) => {
        setConfirmDelete(null);
        if (!r.ok) return;
        setImages((prev) => {
          const rest = prev.filter((i) => i.id !== img.id);
          // the DB promotes the next image to primary; mirror that locally
          return img.is_primary && rest.length ? rest.map((i, n) => ({ ...i, is_primary: n === 0 })) : rest;
        });
      },
    });

  const saveAlt = (img: ManagedImage, alt: string) => {
    if ((img.alt_text ?? "") === alt.trim()) return;
    run(() => updateImageAltAction(img.id, alt), {
      refresh: false,
      onDone: (r) => r.ok && setImages((prev) => prev.map((i) => (i.id === img.id ? { ...i, alt_text: alt.trim() || null } : i))),
    });
  };

  return (
    <Card title="صور المنتج">
      <p className="-mt-2 mb-4 text-sm text-muted">
        الصورة المميّزة بشارة «رئيسية» هي التي تظهر في بطاقة المنتج. اسحب الصور لإعادة ترتيبها أو استخدم أزرار الأسهم. تُحوَّل الصور تلقائياً إلى WebP وتُزال بيانات الموقع (EXIF).
        {!published && " يجب إضافة صورة واحدة على الأقل قبل النشر."}
      </p>

      <div
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            setDragOver(true);
          }
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return;
          e.preventDefault();
          setDragOver(false);
          void addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
          dragOver ? "border-primary bg-surface-sand" : "border-line bg-surface-warm",
        )}
      >
        <UploadCloud className="size-8 text-accent-text" aria-hidden="true" />
        <p className="text-sm font-semibold">اسحب الصور هنا أو</p>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={remaining <= 0}
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-55"
        >
          <ImagePlus className="size-4" aria-hidden="true" />
          اختر صوراً
        </button>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-label="رفع صور المنتج"
          data-testid="image-input"
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="text-xs text-muted">
          JPG / PNG / WebP / AVIF · حتى 8 ميغابايت للصورة · {images.length} من {IMAGE_LIMITS.maxImagesPerProduct}
        </p>
      </div>

      {uploads.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2" aria-live="polite">
          {uploads.map((u) => (
            <li key={u.key} className={cn("flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm", u.state === "error" ? "border-error/30 bg-error-bg text-error" : "border-line-soft bg-surface")}>
              <span className="min-w-0 truncate" dir="ltr">
                {u.name}
              </span>
              <span className="flex shrink-0 items-center gap-2 font-semibold">
                {u.state === "uploading" ? "جاري الرفع…" : u.message}
                {u.state === "error" && (
                  <button type="button" className="underline" onClick={() => setUploads((x) => x.filter((i) => i.key !== u.key))}>
                    إخفاء
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {images.length === 0 ? (
        <p className="mt-4 rounded-md bg-surface-sand p-4 text-center text-sm text-muted">لا توجد صور بعد.</p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {images.map((img, i) => (
            <li
              key={img.id}
              draggable
              onDragStart={() => setDragId(img.id)}
              onDragEnd={() => setDragId(null)}
              onDragOver={(e) => dragId && e.preventDefault()}
              onDrop={(e) => drop(e, img.id)}
              className={cn("flex flex-col overflow-hidden rounded-lg border bg-surface", img.is_primary ? "border-accent" : "border-line-soft", dragId === img.id && "opacity-50")}
            >
              <div className="relative aspect-[4/5] bg-surface-sand">
                <Image src={img.public_url} alt={img.alt_text ?? ""} fill sizes="(min-width:1280px) 20vw, (min-width:640px) 30vw, 45vw" className="object-cover" draggable={false} />
                {img.is_primary && (
                  <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-on-accent">
                    <Star className="size-3 fill-current" aria-hidden="true" />
                    رئيسية
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2 p-2.5">
                <label className="sr-only" htmlFor={`alt-${img.id}`}>
                  النص البديل للصورة {i + 1}
                </label>
                <input
                  id={`alt-${img.id}`}
                  defaultValue={img.alt_text ?? ""}
                  maxLength={200}
                  placeholder="نص بديل للصورة"
                  onBlur={(e) => saveAlt(img, e.target.value)}
                  className="h-10 w-full rounded-md border border-line bg-surface px-2.5 text-sm"
                />
                <div className="flex items-center justify-between gap-1">
                  <div className="flex gap-1">
                    <button type="button" aria-label={`تقديم الصورة ${i + 1}`} disabled={i === 0 || pending} onClick={() => move(img.id, -1)} className="grid size-11 place-items-center md:size-10 rounded-md border border-line hover:bg-surface-sand disabled:opacity-40">
                      <ChevronRight className="size-4" aria-hidden="true" />
                    </button>
                    <button type="button" aria-label={`تأخير الصورة ${i + 1}`} disabled={i === images.length - 1 || pending} onClick={() => move(img.id, 1)} className="grid size-11 place-items-center md:size-10 rounded-md border border-line hover:bg-surface-sand disabled:opacity-40">
                      <ChevronLeft className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="flex gap-1">
                    {!img.is_primary && (
                      <button type="button" aria-label={`تعيين الصورة ${i + 1} كرئيسية`} title="تعيين كرئيسية" disabled={pending} onClick={() => makePrimary(img.id)} className="grid size-11 place-items-center md:size-10 rounded-md border border-line hover:bg-surface-sand">
                        <Star className="size-4" aria-hidden="true" />
                      </button>
                    )}
                    {canDelete && (
                      <button type="button" aria-label={`حذف الصورة ${i + 1}`} title="حذف" disabled={pending} onClick={() => setConfirmDelete(img)} className="grid size-11 place-items-center md:size-10 rounded-md border border-line text-error hover:border-error hover:bg-error-bg">
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {confirmDelete && (
        <ConfirmDialog
          danger
          title="حذف الصورة؟"
          description="ستُحذف الصورة من المنتج ومن التخزين نهائياً."
          confirmLabel="حذف الصورة"
          busy={pending}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => remove(confirmDelete)}
        />
      )}
    </Card>
  );
}
