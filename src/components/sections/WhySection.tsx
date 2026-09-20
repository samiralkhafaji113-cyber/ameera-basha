import Image from "next/image";
import { CalendarCheck, GraduationCap, LayoutGrid, MessageCircle, Truck, Users } from "lucide-react";
import type { ReactNode } from "react";
import { ar } from "@/content/ar";
import { SectionHeading } from "@/components/ui/SectionHeading";

const ICONS: Record<string, ReactNode> = {
  grid: <LayoutGrid className="size-6" aria-hidden="true" />,
  users: <Users className="size-6" aria-hidden="true" />,
  school: <GraduationCap className="size-6" aria-hidden="true" />,
  booking: <CalendarCheck className="size-6" aria-hidden="true" />,
  truck: <Truck className="size-6" aria-hidden="true" />,
  chat: <MessageCircle className="size-6" aria-hidden="true" />,
};

export function WhySection() {
  const t = ar.why;
  return (
    <section id="about" aria-labelledby="why-title" className="py-14 sm:py-20">
      <div className="container-page grid items-start gap-10 lg:grid-cols-[1.6fr_1fr] lg:gap-14">
        <div>
          <SectionHeading id="why-title" eyebrow={t.eyebrow} title={t.title} />
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {t.items.map((item) => (
              <li key={item.title} className="flex gap-4 rounded-lg border border-line-soft bg-surface p-5 shadow-card">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-surface-sand text-accent-text">{ICONS[item.icon]}</span>
                <div>
                  <h3 className="!text-lg">{item.title}</h3>
                  <p className="mt-1 text-sm leading-7 text-muted">{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <figure className="mx-auto w-full max-w-sm lg:max-w-none">
          <div className="relative aspect-[9/10] overflow-hidden rounded-t-full rounded-b-lg border border-line-soft bg-surface-sand shadow-card-hover">
            <Image src="/store/interior.webp" alt={t.photoAlt} fill sizes="(min-width: 1024px) 360px, 90vw" className="object-cover" />
          </div>
          <figcaption className="mt-3 text-center text-sm font-semibold text-muted">{t.photoCaption}</figcaption>
        </figure>
      </div>
    </section>
  );
}
