import { MapPin, MessageCircle, Phone, PhoneCall } from "lucide-react";
import type { ReactNode } from "react";
import { ar } from "@/content/ar";
import { socialLinks } from "@/data/social";
import { site, telHref, viberHref } from "@/lib/site";
import { generalInquiryMessage, whatsappUrl } from "@/lib/whatsapp";
import { SocialIcon } from "@/components/ui/BrandIcons";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { CopyPhoneButton } from "./CopyPhoneButton";

interface Item {
  key: string;
  label: string;
  hint: string;
  href: string;
  icon: ReactNode;
  value?: string;
  tone: string;
}

export function ContactSection() {
  const t = ar.contact;
  const items: Item[] = [
    { key: "phone", label: t.phone, hint: t.phoneHint, href: telHref, icon: <Phone className="size-6" aria-hidden="true" />, value: site.phone.display, tone: "bg-primary text-on-primary" },
    { key: "wa", label: t.whatsapp, hint: t.whatsappHint, href: whatsappUrl(site.phone.wa, generalInquiryMessage), icon: <MessageCircle className="size-6" aria-hidden="true" />, value: site.phone.display, tone: "bg-whatsapp text-white" },
    { key: "viber", label: t.viber, hint: t.viberHint, href: viberHref, icon: <PhoneCall className="size-6" aria-hidden="true" />, value: site.phone.display, tone: "bg-secondary text-on-secondary" },
    { key: "maps", label: t.maps, hint: t.mapsHint, href: site.links.maps, icon: <MapPin className="size-6" aria-hidden="true" />, tone: "bg-surface-sand-strong text-primary" },
    ...socialLinks().map((s) => ({
      key: s.id,
      label: s.name,
      hint: s.blurb,
      href: s.url,
      icon: <SocialIcon id={s.id} className="size-6" />,
      tone: "bg-surface-sand-strong text-primary",
    })),
  ];

  return (
    <section id="contact" aria-labelledby="contact-title" className="bg-surface-warm py-14 sm:py-20">
      <div className="container-page">
        <SectionHeading id="contact-title" eyebrow={t.eyebrow} title={t.title} description={t.subtitle} />
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {items.map((item) => {
            const web = item.href.startsWith("http");
            return (
              <li key={item.key}>
                <a
                  href={item.href}
                  {...(web ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="group flex h-full items-center gap-4 rounded-lg border border-line-soft bg-surface p-4 shadow-card transition-[box-shadow,transform,border-color] duration-200 ease-soft hover:-translate-y-0.5 hover:border-line hover:shadow-card-hover"
                >
                  <span className={`grid size-12 shrink-0 place-items-center rounded-full ${item.tone}`}>{item.icon}</span>
                  <span className="flex min-w-0 flex-col">
                    <span className="font-heading text-base font-bold text-text">{item.label}</span>
                    {item.value ? (
                      <span dir="ltr" className="text-start text-sm font-semibold text-secondary">
                        {item.value}
                      </span>
                    ) : null}
                    <span className="text-xs text-muted">{item.hint}</span>
                    {web && <span className="sr-only"> – {ar.nav.opensNew}</span>}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
        <div className="mt-5">
          <CopyPhoneButton />
        </div>
      </div>
    </section>
  );
}
