import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Baby, MessageCircle, Ruler } from "lucide-react";
import { ar } from "@/content/ar";
import { site } from "@/lib/site";
import { cn } from "@/lib/cn";
import { sourceMeta } from "@/data/sources";
import { formatDateShort, formatPrice } from "@/lib/format";
import { productHref, sizeFieldLabel } from "@/lib/product";
import { productInquiryMessage, whatsappUrl } from "@/lib/whatsapp";
import type { Product } from "@/types/product";
import { Badge } from "@/components/ui/Badge";
import { SocialIcon } from "@/components/ui/BrandIcons";
import { ButtonLink } from "@/components/ui/Button";
import { ReserveButton } from "./ReserveButton";

export type CardView = "grid" | "list";

export function ProductCard({
  product,
  view = "grid",
  preload = false,
  featured = false,
}: {
  product: Product;
  view?: CardView;
  preload?: boolean;
  /** A single, wider "editorial" card (varying image ratio) used for the first result on an unfiltered grid. */
  featured?: boolean;
}) {
  const t = ar.product;
  const cover = product.images[0];
  const source = sourceMeta(product.source);
  const list = view === "list";
  const href = productHref(product);
  const unavailable = product.available === false;
  const sizeLabel = sizeFieldLabel(product);

  const second = product.images[1];

  if (list) {
    return (
      <article className="group relative flex h-full w-full flex-row overflow-hidden rounded-md border border-line-soft bg-surface transition-[border-color,box-shadow] duration-200 ease-soft hover:border-line hover:shadow-card">
        <Link href={href} tabIndex={-1} aria-hidden="true" className="relative block aspect-[4/5] w-32 shrink-0 overflow-hidden bg-surface-sand sm:w-44">
          {cover && (
            <Image src={cover.src} alt={product.name} fill preload={preload} sizes="176px" className="object-cover transition-transform duration-500 ease-soft group-hover:scale-[1.04]" />
          )}
          {(product.available || unavailable) && (
            <span className="absolute start-2 top-2">
              <Badge tone={unavailable ? "error" : "success"} className="shadow-card">
                {unavailable ? t.unavailable : t.availableBySource}
              </Badge>
            </span>
          )}
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-2 p-3 sm:p-4">
          <p className="label-editorial text-accent-text">{product.categoryName}</p>
          <h3 className="!text-base leading-snug sm:!text-lg">
            <Link href={href} className="rounded underline-offset-4 hover:underline">
              {product.name}
            </Link>
          </h3>
          {product.sizeLabel && (
            <p className="flex items-start gap-1.5 text-sm leading-6 text-muted">
              {product.ageRange ? <Baby className="mt-1 size-4 shrink-0" aria-hidden="true" /> : <Ruler className="mt-1 size-4 shrink-0" aria-hidden="true" />}
              <span>
                {sizeLabel}: {product.sizeLabel}
              </span>
            </p>
          )}
          {product.price !== undefined ? (
            <p className="text-lg font-bold text-text">{formatPrice(product.price)}</p>
          ) : (
            <p className="text-sm font-semibold text-muted">{t.priceOnRequest}</p>
          )}
          <p className="flex flex-col gap-0.5 text-xs leading-5 text-muted sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-1.5">
            {source && (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <SocialIcon id={source.icon} className="size-3.5 shrink-0" />
                  <span className="sr-only">{t.sourceLabel}: </span>
                  {source.label}
                </span>
                <span aria-hidden="true" className="hidden sm:inline">
                  ·
                </span>
              </>
            )}
            <time dateTime={product.postedAt}>{formatDateShort(product.postedAt)}</time>
          </p>
          <div className="mt-auto flex flex-col gap-0.5 pt-2 sm:flex-row sm:items-center sm:gap-3">
            {unavailable ? (
              <ButtonLink href={whatsappUrl(site.phone.wa, productInquiryMessage(product.name))} variant="whatsapp" size="sm" className="sm:flex-1" icon={<MessageCircle className="size-[18px]" aria-hidden="true" />}>
                {t.askAvailability}
              </ButtonLink>
            ) : (
              <ReserveButton product={product} className="sm:flex-1" />
            )}
            <Link href={href} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-md px-2 text-sm font-semibold text-secondary underline-offset-4 transition-colors hover:text-text hover:underline">
              {t.details}
              <ArrowLeft className="size-4 ltr:rotate-180" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </article>
    );
  }

  // Grid view: image-first editorial card – minimal frame, the picture (not a boxed shell) carries the design.
  // A second product photo (when the source posted one) crossfades in on hover as a quiet "there's more" cue.
  return (
    <article className="group relative flex h-full w-full flex-col">
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden="true"
        className={cn("relative block w-full overflow-hidden rounded-[3px] bg-surface-sand", featured ? "aspect-[16/10]" : "aspect-[4/5]")}
      >
        {cover && (
          <Image
            src={cover.src}
            alt={product.name}
            fill
            preload={preload}
            sizes={featured ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"}
            className={cn("object-cover transition-[transform,opacity] duration-500 ease-soft group-hover:scale-[1.04]", second && "group-hover:opacity-0")}
          />
        )}
        {second && (
          <Image
            src={second.src}
            alt=""
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover opacity-0 transition-[transform,opacity] duration-500 ease-soft group-hover:scale-[1.04] group-hover:opacity-100"
          />
        )}
        {(product.available || unavailable) && (
          <span className="absolute start-2.5 top-2.5">
            <Badge tone={unavailable ? "error" : "success"} className="shadow-card">
              {unavailable ? t.unavailable : t.availableBySource}
            </Badge>
          </span>
        )}
        {/* Reserve/inquire: an editorial overlay bar that rises on hover (pointer devices) and stays
            put on touch – always reachable, never hidden behind a hover that can't happen on a phone. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-image-overlay to-transparent opacity-0 transition-opacity duration-300 ease-soft lg:group-hover:opacity-100"
        />
        <span className="absolute inset-x-2.5 bottom-2.5 translate-y-0 opacity-100 transition-[transform,opacity] duration-300 ease-soft lg:translate-y-2 lg:opacity-0 lg:group-hover:translate-y-0 lg:group-hover:opacity-100">
          {unavailable ? (
            <ButtonLink href={whatsappUrl(site.phone.wa, productInquiryMessage(product.name))} variant="inverse" size="sm" className="w-full !bg-white/95 backdrop-blur-sm" icon={<MessageCircle className="size-[16px]" aria-hidden="true" />}>
              {t.askAvailability}
            </ButtonLink>
          ) : (
            <ReserveButton product={product} variant="inverse" className="w-full !bg-white/95 backdrop-blur-sm" />
          )}
        </span>
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-3">
        <p className="label-editorial text-accent-text">{product.categoryName}</p>
        <h3 className={cn("leading-snug", featured ? "!text-xl sm:!text-2xl" : "!text-base")}>
          <Link href={href} className="rounded underline-offset-4 hover:underline">
            {product.name}
          </Link>
        </h3>
        {product.sizeLabel && (
          <p className="flex items-center gap-1.5 text-xs leading-5 text-muted">
            {product.ageRange ? <Baby className="size-3.5 shrink-0" aria-hidden="true" /> : <Ruler className="size-3.5 shrink-0" aria-hidden="true" />}
            {sizeLabel}: {product.sizeLabel}
          </p>
        )}
        {product.price !== undefined ? (
          <p className="mt-0.5 text-base font-bold text-text">{formatPrice(product.price)}</p>
        ) : (
          <p className="mt-0.5 text-sm font-semibold text-muted">{t.priceOnRequest}</p>
        )}
      </div>
    </article>
  );
}
