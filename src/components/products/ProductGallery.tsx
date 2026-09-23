"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { KeyboardEvent, TouchEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { ar } from "@/content/ar";
import { cn } from "@/lib/cn";
import { DURATION, EASE_SOFT } from "@/lib/motion";
import type { ProductImage } from "@/types/product";

export function ProductGallery({ images, name }: { images: ProductImage[]; name: string }) {
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const thumbs = useRef<(HTMLButtonElement | null)[]>([]);
  const total = images.length;
  const current = images[index];

  const go = (i: number) => setIndex((i + total) % total);

  // Page direction is RTL: "next" is to the left, so a swipe to the left (dx < 0) advances.
  const onTouchEnd = (e: TouchEvent) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > 48) go(index + (dx < 0 ? 1 : -1));
  };

  const onThumbKey = (e: KeyboardEvent, i: number) => {
    const next = e.key === "ArrowLeft" ? i + 1 : e.key === "ArrowRight" ? i - 1 : null; // RTL
    if (next === null) return;
    e.preventDefault();
    const target = (next + total) % total;
    go(target);
    thumbs.current[target]?.focus();
  };

  if (!current) return null;

  return (
    <div className="flex flex-col gap-3" role="group" aria-roledescription="carousel" aria-label={ar.product.gallery}>
      <div
        className="relative aspect-[4/5] overflow-hidden rounded-lg border border-line-soft bg-surface-sand"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={onTouchEnd}
      >
        <AnimatePresence initial={false} mode="sync">
          <motion.div
            key={current.src}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1, transition: { duration: DURATION.base, ease: EASE_SOFT } }}
            exit={{ opacity: 0, transition: { duration: DURATION.fast, ease: EASE_SOFT } }}
          >
            <Image
              src={current.src}
              alt={`${name} – ${ar.product.image(index + 1, total)}`}
              fill
              preload={index === 0}
              sizes="(min-width: 1024px) 560px, 100vw"
              className="object-contain"
            />
          </motion.div>
        </AnimatePresence>
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="الصورة التالية"
              className="absolute start-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-text shadow-card transition-colors hover:bg-white"
            >
              <ChevronLeft className="size-5 ltr:rotate-180" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="الصورة السابقة"
              className="absolute end-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-text shadow-card transition-colors hover:bg-white"
            >
              <ChevronRight className="size-5 ltr:rotate-180" aria-hidden="true" />
            </button>
            <p
              aria-live="polite"
              className="absolute bottom-3 start-3 rounded-full bg-primary/80 px-3 py-1 text-xs font-semibold text-white"
            >
              {ar.product.image(index + 1, total)}
            </p>
          </>
        )}
      </div>

      {total > 1 && (
        <ul className="grid grid-cols-4 gap-2 sm:gap-3">
          {images.map((img, i) => (
            <li key={img.src}>
              <button
                type="button"
                ref={(el) => {
                  thumbs.current[i] = el;
                }}
                onClick={() => setIndex(i)}
                onKeyDown={(e) => onThumbKey(e, i)}
                aria-label={ar.product.image(i + 1, total)}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "relative block aspect-square w-full overflow-hidden rounded-md border-2 bg-surface-sand transition-[border-color,opacity] duration-200",
                  i === index ? "border-primary" : "border-transparent opacity-75 hover:opacity-100",
                )}
              >
                <Image src={img.src} alt="" fill sizes="120px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
