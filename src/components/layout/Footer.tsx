import Link from "next/link";
import { MapPin, MessageCircle, Phone, PhoneCall } from "lucide-react";
import { ar } from "@/content/ar";
import { socialLinks } from "@/data/social";
import { site, telHref, viberHref } from "@/lib/site";
import { generalInquiryMessage, whatsappUrl } from "@/lib/whatsapp";
import { SocialIcon } from "@/components/ui/BrandIcons";
import { Logo } from "./Logo";

const linkCls =
  "flex w-fit min-h-10 items-center gap-2 rounded text-stone-300 underline-offset-4 transition-colors hover:text-white hover:underline";

const roundBtn =
  "grid size-11 place-items-center rounded-full border border-white/20 text-stone-200 transition-colors duration-200 hover:border-white hover:bg-white hover:text-primary";

/**
 * Footer: brand column carries the (white variant of the) official logo and a row of circular social buttons –
 * the compact "logo + round social icons" arrangement of the 21st.dev footer patterns (e.g. «Simple Centered
 * Footer», ln-dev7) – then quick links and contact details. Server component, zero client JS.
 */
export function Footer() {
  const socials = socialLinks();
  return (
    <footer className="on-dark mt-auto bg-primary text-stone-300">
      <div className="container-page grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-[1.3fr_0.8fr_1.3fr]">
        <div className="flex flex-col items-start gap-4">
          <Logo inverse imageClassName="h-28" />
          <p className="max-w-xs text-sm leading-7">{ar.footer.about}</p>
          <ul className="flex flex-wrap gap-2" aria-label={ar.nav.social}>
            {socials.map((s) => (
              <li key={s.id}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" aria-label={`${s.name} – ${ar.nav.opensNew}`} title={s.name} className={roundBtn}>
                  <SocialIcon id={s.id} className="size-[18px]" />
                </a>
              </li>
            ))}
            <li>
              <a
                href={whatsappUrl(site.phone.wa, generalInquiryMessage)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`WhatsApp – ${ar.nav.opensNew}`}
                title="WhatsApp"
                className={roundBtn}
              >
                <MessageCircle className="size-[18px]" aria-hidden="true" />
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="!text-base !text-white">{ar.footer.links}</h2>
          <ul className="mt-3 space-y-0.5">
            {[
              { href: "/", label: ar.nav.home },
              { href: "/products", label: ar.nav.products },
              { href: "/#categories", label: ar.nav.categories },
              { href: "/#delivery", label: ar.nav.delivery },
              { href: "/#location", label: ar.nav.location },
              { href: "/#contact", label: ar.nav.contact },
            ].map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={linkCls}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="!text-base !text-white">{ar.nav.contact}</h2>
          <address className="mt-3 space-y-0.5 not-italic">
            <p className="flex items-start gap-2 text-sm leading-7">
              <MapPin className="mt-1.5 size-4 shrink-0 text-surface-sand-strong" aria-hidden="true" />
              <span>{site.address.line}</span>
            </p>
            <a href={telHref} className={linkCls}>
              <Phone className="size-4 text-surface-sand-strong" aria-hidden="true" />
              <span dir="ltr">{site.phone.display}</span>
            </a>
            <a href={viberHref} className={linkCls}>
              <PhoneCall className="size-4 text-surface-sand-strong" aria-hidden="true" />
              Viber
            </a>
            <a href={site.links.maps} target="_blank" rel="noopener noreferrer" className={linkCls}>
              <MapPin className="size-4 text-surface-sand-strong" aria-hidden="true" />
              Google Maps
              <span className="sr-only"> – {ar.nav.opensNew}</span>
            </a>
          </address>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-5 text-xs leading-6 text-stone-400 md:flex-row md:items-center md:justify-between">
          <p className="max-w-3xl">{ar.footer.disclaimer}</p>
          <p dir="ltr" className="shrink-0">
            {ar.footer.copyright}
          </p>
        </div>
      </div>
    </footer>
  );
}
