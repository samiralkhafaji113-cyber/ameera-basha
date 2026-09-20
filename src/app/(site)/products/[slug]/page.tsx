import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { MessageCircle, Phone, Truck } from "lucide-react";
import { ar } from "@/content/ar";
import { sourceMeta } from "@/data/sources";
import { getProductRepository } from "@/lib/catalog";
import { formatDate, formatPrice } from "@/lib/format";
import { sizeFieldLabel } from "@/lib/product";
import { site, telHref } from "@/lib/site";
import { productInquiryMessage, whatsappUrl } from "@/lib/whatsapp";
import { Badge } from "@/components/ui/Badge";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ButtonLink } from "@/components/ui/Button";
import { ProductCard } from "@/components/products/ProductCard";
import { ProductGallery } from "@/components/products/ProductGallery";
import { ReserveButton } from "@/components/products/ReserveButton";
import { ShareButton } from "@/components/products/ShareButton";
import { SocialIcon } from "@/components/ui/BrandIcons";
import { JsonLd } from "@/components/seo/JsonLd";
import { productSchema } from "@/components/seo/schemas";

export async function generateStaticParams() {
  try {
    const products = await getProductRepository().list();
    return products.map((p) => ({ slug: p.slug }));
  } catch {
    return []; // database unreachable at build time → render on demand (still cached + tagged)
  }
}

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductRepository().getBySlug(slug);
  if (!p) return { title: ar.product.notFoundTitle };
  const cover = p.images[0];
  const bits = [p.categoryName, p.sizeLabel && `${sizeFieldLabel(p)}: ${p.sizeLabel}`, p.price && formatPrice(p.price)].filter(Boolean);
  const description = `${p.name} – ${bits.join(" – ")}. للحجز والاستفسار: مجمع أميرة باشا – الحلة – ${site.phone.display}.`;
  return {
    title: p.name,
    description,
    alternates: { canonical: `/products/${p.slug}` },
    openGraph: {
      type: "website",
      title: `${p.name} | ${site.nameAr}`,
      description,
      url: `/products/${p.slug}`,
      images: cover ? [{ url: cover.src, width: cover.width, height: cover.height, alt: p.name }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const repo = getProductRepository();
  const p = await repo.getBySlug(slug);
  if (!p) {
    // a renamed product keeps its old URL: 308 → the current slug (only for published products)
    const current = await repo.resolveSlug(slug);
    if (current && current !== slug) permanentRedirect(`/products/${current}`);
    notFound();
  }
  const related = await repo.related(p, 4);

  const t = ar.product;
  const source = sourceMeta(p.source);
  const sub = p.subcategoryName;
  const unavailable = p.available === false;
  const sizeLabel = sizeFieldLabel(p);
  const inquiryUrl = whatsappUrl(site.phone.wa, productInquiryMessage(p.name));

  const facts: { label: string; value: string }[] = [
    { label: t.category, value: sub ? `${p.categoryName} – ${sub}` : p.categoryName },
    ...(p.sizeLabel ? [{ label: sizeLabel, value: p.sizeLabel }] : []),
    { label: t.availability, value: unavailable ? t.unavailable : p.available ? t.availableBySource : t.availabilityUnknown },
    { label: t.posted, value: formatDate(p.postedAt) },
    ...(source ? [{ label: t.sourceLabel, value: source.label }] : []),
  ];

  return (
    <div className="container-page py-6 sm:py-10">
      <Breadcrumb
        items={[
          { label: ar.nav.home, href: "/" },
          { label: ar.nav.products, href: "/products" },
          { label: p.categoryName, href: `/products?category=${p.category}` },
          { label: p.name },
        ]}
      />

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
        <ProductGallery images={p.images} name={p.name} />

        <div className="flex flex-col gap-5 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:self-start">
          <div className="flex flex-wrap gap-2">
            <Badge tone="gold">{p.categoryName}</Badge>
            {sub && <Badge>{sub}</Badge>}
            {p.available && <Badge tone="success">{t.availableBySource}</Badge>}
            {unavailable && <Badge tone="error">{t.unavailable}</Badge>}
          </div>

          <h1 className="!text-[clamp(1.875rem,1.4rem+2vw,2.75rem)]">{p.name}</h1>

          <p className="text-3xl font-bold text-text">
            {p.price !== undefined ? formatPrice(p.price) : <span className="text-xl text-muted">{t.priceOnRequest}</span>}
          </p>

          {p.description && <p className="text-base leading-8 text-secondary">{p.description}</p>}

          <dl className="divide-y divide-line-soft rounded-lg border border-line-soft bg-surface">
            {facts.map((f) => (
              <div key={f.label} className="flex items-baseline justify-between gap-4 px-4 py-3">
                <dt className="text-sm font-semibold text-muted">{f.label}</dt>
                <dd className="text-start text-sm font-semibold text-text">{f.value}</dd>
              </div>
            ))}
          </dl>

          {unavailable ? (
            <div className="rounded-md border border-warning/30 bg-warning-bg p-4 text-sm text-warning">{t.unavailableNote}</div>
          ) : null}

          <div id="product-actions" className="grid scroll-mt-24 gap-3 sm:grid-cols-2">
            {unavailable ? (
              <ButtonLink href={inquiryUrl} variant="whatsapp" size="lg" className="sm:col-span-2" icon={<MessageCircle className="size-5" aria-hidden="true" />}>
                {t.askAvailability}
              </ButtonLink>
            ) : (
              <>
                <ReserveButton product={p} size="lg" className="sm:col-span-2" />
                <ButtonLink href={inquiryUrl} variant="whatsapp" size="lg" icon={<MessageCircle className="size-5" aria-hidden="true" />}>
                  {t.whatsapp}
                </ButtonLink>
              </>
            )}
            <ButtonLink href={telHref} variant="secondary" size="lg" aria-label={`${t.call} ${site.phone.display}`} icon={<Phone className="size-5" aria-hidden="true" />}>
              {t.call}
            </ButtonLink>
          </div>

          <p className="flex items-start gap-2 text-sm leading-7 text-muted">
            <Truck className="mt-1.5 size-4 shrink-0 text-accent-text" aria-hidden="true" />
            {t.deliveryNote}
          </p>
          {source && <p className="text-xs leading-6 text-muted">{t.priceNote.replace("{date}", formatDate(p.postedAt))}</p>}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {p.sourceUrl && source && (
              <a
                href={p.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-accent-text underline underline-offset-4"
              >
                <SocialIcon id={source.icon} className="size-4" />
                {t.source(source.label)}
                <span className="sr-only"> – {ar.nav.opensNew}</span>
              </a>
            )}
            <ShareButton name={p.name} path={`/products/${p.slug}`} />
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related-title" className="mt-16">
          <h2 id="related-title">{t.related}</h2>
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {related.map((r) => (
              <li key={r.id} className="flex min-w-0">
                <div className="flex min-w-0 flex-1">
                  <ProductCard product={r} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <JsonLd data={productSchema(p)} />
    </div>
  );
}
