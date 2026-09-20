import Image from "next/image";
import { MapPin, Phone } from "lucide-react";
import { ar } from "@/content/ar";
import { site, telHref } from "@/lib/site";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function LocationSection() {
  const t = ar.location;
  return (
    <section id="location" aria-labelledby="location-title" className="py-14 sm:py-20">
      <div className="container-page">
        <SectionHeading id="location-title" eyebrow={t.eyebrow} title={t.title} />

        {/* Mobile order: address → map → storefront photo. Desktop: address + photo (col 1) | map (col 2). */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.25fr] lg:gap-8">
          <div className="flex flex-col gap-5 lg:col-start-1 lg:row-start-1">
            <div className="flex gap-4 rounded-lg border border-line-soft bg-surface p-5 shadow-card">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-surface-sand text-accent-text">
                <MapPin className="size-6" aria-hidden="true" />
              </span>
              <div>
                <h3 className="!text-lg">{t.addressLabel}</h3>
                <address className="mt-1 text-base not-italic leading-8">{site.address.line}</address>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <ButtonLink href={site.links.maps} variant="primary" size="lg" icon={<MapPin className="size-5" aria-hidden="true" />}>
                {t.openMaps}
              </ButtonLink>
              <ButtonLink href={telHref} variant="secondary" size="lg" icon={<Phone className="size-5" aria-hidden="true" />}>
                {t.call}
              </ButtonLink>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-line-soft bg-surface-sand shadow-card lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <iframe
              title={t.mapTitle}
              src={site.links.mapsEmbed}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
              className="block aspect-[4/3] min-h-72 w-full border-0 lg:aspect-auto lg:h-full lg:min-h-[28rem]"
            />
          </div>

          <figure className="lg:col-start-1 lg:row-start-2">
            <div className="relative aspect-[16/10] overflow-hidden rounded-lg border border-line-soft bg-surface-sand shadow-card">
              <Image src="/store/facade.webp" alt={t.photoAlt} fill sizes="(min-width: 1024px) 440px, 100vw" className="object-cover object-[50%_28%]" />
            </div>
            <figcaption className="mt-2 text-sm font-semibold text-muted">{t.photoCaption}</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
