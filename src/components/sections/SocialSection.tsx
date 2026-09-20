import { MessageCircle } from "lucide-react";
import type { ReactNode } from "react";
import { ar } from "@/content/ar";
import { socialLinks } from "@/data/social";
import { site } from "@/lib/site";
import { generalInquiryMessage, whatsappUrl } from "@/lib/whatsapp";
import { SocialIcon } from "@/components/ui/BrandIcons";
import { SectionHeading } from "@/components/ui/SectionHeading";

interface Tile {
  key: string;
  name: string;
  blurb: string;
  href: string;
  icon: ReactNode;
  accent?: boolean;
}

/**
 * "Follow us" strip – deliberately compact so it never competes with the products.
 * Layout idea from the 21st.dev "Social Media" icon row (one equal-weight tile per platform, label revealed
 * beside the icon); implemented with plain links – no client JS. Purely link-driven: no feed/API is integrated,
 * so nothing here pretends to be live content. Channels come from src/data/social.ts.
 */
export function SocialSection() {
  const t = ar.social;
  const tiles: Tile[] = [
    ...socialLinks().map((s) => ({ key: s.id, name: s.name, blurb: s.blurb, href: s.url, icon: <SocialIcon id={s.id} className="size-5" /> })),
    {
      key: "whatsapp",
      name: "WhatsApp",
      blurb: t.whatsappBlurb,
      href: whatsappUrl(site.phone.wa, generalInquiryMessage),
      icon: <MessageCircle className="size-5" aria-hidden="true" />,
      accent: true,
    },
  ];

  return (
    <section id="social" aria-labelledby="social-title" className="border-y border-line-soft bg-surface py-10 sm:py-12">
      <div className="container-page">
        <SectionHeading id="social-title" title={t.title} description={t.subtitle} className="[&_h2]:!text-2xl" />
        <ul className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
          {tiles.map((s) => (
            <li key={s.key} className="min-w-0">
              <a
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex h-full min-h-[4.25rem] items-center gap-3 rounded-lg border border-line-soft bg-bg p-3 transition-[border-color,background-color] duration-200 hover:border-primary hover:bg-surface-warm"
              >
                <span
                  className={
                    s.accent
                      ? "grid size-10 shrink-0 place-items-center rounded-full bg-whatsapp text-white"
                      : "grid size-10 shrink-0 place-items-center rounded-full bg-primary text-on-primary"
                  }
                >
                  {s.icon}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-text">{s.name}</span>
                  <span className="block text-xs leading-5 text-muted">{s.blurb}</span>
                </span>
                <span className="sr-only"> – {ar.nav.opensNew}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
