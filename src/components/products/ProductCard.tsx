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

export function ProductCard({ product, view = "grid", preload = false }: { product: Product; view?: CardView; preload?: boolean }) {
  const t = ar.product;
  const cover = product.images[0];
  const source = sourceMeta(product.source);
  const list = view === "list";
  const href = productHref(product);
  const unavailable = product.available === false;
  const sizeLabel = sizeFieldLabel(product);

  return (
    <article
      className={cn(
        "group relative flex h-full w-full overflow-hidden rounded-lg border border-line-soft bg-surface shadow-card",
        "transition-[box-shadow,transform,border-color] duration-200 ease-soft hover:-translate-y-0.5 hover:border-line hover:shadow-card-hover",
        list ? "flex-row" : "flex-col",
      )}
    >
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden="true"
        className={cn("relative block shrink-0 overflow-hidden bg-surface-sand", list ? "aspect-[4/5] w-32 sm:w-44" : "aspect-[4/5] w-full")}
      >
        {cover && (
          <Image
            src={cover.src}
            alt={product.name}
            fill
            preload={preload}
            sizes={list ? "176px" : "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"}
            className="object-cover transition-transform duration-500 ease-soft group-hover:scale-[1.05]"
          />
        )}
        {/* Premium image-first hover: a soft wash rises from the base so the eye reads "there's more here"
            without covering the product itself – transform/opacity only, no layout impact. */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-image-overlay to-transparent opacity-0 transition-opacity duration-300 ease-soft group-hover:opacity-100"
        />
        {(product.available || unavailable) && (
          <span className="absolute start-2 top-2">
            <Badge tone={unavailable ? "error" : "success"} className="shadow-card">
              {unavailable ? t.unavailable : t.availableBySource}
            </Badge>
          </span>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3 sm:p-4">
        <p className="text-xs font-semibold text-accent-text">{product.categoryName}</p>
        <h3 className="!text-base leading-snug sm:!text-lg">
          <Link href={href} className="rounded underline-offset-4 hover:underline">
            {product.name}
          </Link>
        </h3>

        {product.sizeLabel && (
          <p className="flex items-start gap-1.5 text-sm leading-6 text-muted">
            {product.ageRange ? (
              <Baby className="mt-1 size-4 shrink-0" aria-hidden="true" />
            ) : (
              <Ruler className="mt-1 size-4 shrink-0" aria-hidden="true" />
            )}
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

        {/* One quiet line: where the info came from + when it was posted */}
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

        {/* One clear primary action; details is a lighter text link (less visual weight than two buttons) */}
        <div className={cn("mt-auto flex flex-col gap-0.5 pt-2", list && "sm:flex-row sm:items-center sm:gap-3")}>
          {unavailable ? (
            <ButtonLink
              href={whatsappUrl(site.phone.wa, productInquiryMessage(product.name))}
              variant="whatsapp"
              size="sm"
              className={list ? "sm:flex-1" : undefined}
              icon={<MessageCircle className="size-[18px]" aria-hidden="true" />}
            >
              {t.askAvailability}
            </ButtonLink>
          ) : (
            <ReserveButton product={product} className={list ? "sm:flex-1" : undefined} />
          )}
          <Link
            href={href}
            className="inline-flex min-h-11 items-center justify-center gap-1 rounded-md px-2 text-sm font-semibold text-secondary underline-offset-4 transition-colors hover:text-text hover:underline"
          >
            {t.details}
            <ArrowLeft className="size-4 ltr:rotate-180" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}
