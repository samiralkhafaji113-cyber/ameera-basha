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
    <section id="about" aria-labelledby="why-title" className="overflow-hidden bg-primary py-16 text-stone-200 sm:py-24">
      <div className="container-page grid items-center gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
        {/* Full-bleed store photo, bleeding to the section edge on large screens for an editorial, less
            "boxed" read than a framed card. */}
        <figure className="relative -mx-4 aspect-[4/3] overflow-hidden sm:-mx-6 lg:mx-0 lg:aspect-[4/5] lg:rounded-md">
          <Image src="/store/interior.webp" alt={t.photoAlt} fill sizes="(min-width: 1024px) 560px, 100vw" className="object-cover" />
          <figcaption className="label-editorial absolute bottom-4 start-4 rounded-sm bg-primary/80 px-3 py-1.5 text-stone-200 backdrop-blur-sm">
            {t.photoCaption}
          </figcaption>
        </figure>

        <div>
          <SectionHeading id="why-title" eyebrow={t.eyebrow} title={t.title} inverse />
          <ul className="mt-8 flex flex-col divide-y divide-white/10 border-t border-white/10">
            {t.items.map((item) => (
              <li key={item.title} className="flex items-start gap-4 py-4">
                <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-white/10 text-surface-sand-strong">{ICONS[item.icon]}</span>
                <div>
                  <h3 className="!text-base !text-white">{item.title}</h3>
                  <p className="mt-1 text-sm leading-7 text-stone-300">{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
