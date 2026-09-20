"use client";

import { usePathname } from "next/navigation";
import { MapPin, MessageCircle, Phone, ShoppingBag } from "lucide-react";
import { ar } from "@/content/ar";
import { site, telHref } from "@/lib/site";
import { generalInquiryMessage, whatsappUrl } from "@/lib/whatsapp";
import { ButtonLink } from "@/components/ui/Button";

/** Persistent one-tap contact bar for phones (the main conversion path for this audience). */
export function MobileActionBar() {
  // On a product page the third slot becomes the primary action: jump to the reserve button.
  const pathname = usePathname();
  const onProduct = /^\/products\/[^/]+$/.test(pathname);
  return (
    <nav
      aria-label={ar.mobileBar.label}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-pop backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-3 gap-2">
        <li>
          <ButtonLink
            href={whatsappUrl(site.phone.wa, generalInquiryMessage)}
            variant="whatsapp"
            className="w-full !px-2"
            icon={<MessageCircle className="size-[18px]" aria-hidden="true" />}
          >
            {ar.mobileBar.whatsapp}
          </ButtonLink>
        </li>
        <li>
          <ButtonLink href={telHref} variant="primary" className="w-full !px-2" icon={<Phone className="size-[18px]" aria-hidden="true" />}>
            {ar.mobileBar.call}
          </ButtonLink>
        </li>
        <li>
          {onProduct ? (
            <ButtonLink href="#product-actions" variant="accent" className="w-full !px-2" icon={<ShoppingBag className="size-[18px]" aria-hidden="true" />}>
              {ar.mobileBar.reserve}
            </ButtonLink>
          ) : (
            <ButtonLink href={site.links.maps} variant="secondary" className="w-full !px-2" icon={<MapPin className="size-[18px]" aria-hidden="true" />}>
              {ar.mobileBar.map}
            </ButtonLink>
          )}
        </li>
      </ul>
    </nav>
  );
}
