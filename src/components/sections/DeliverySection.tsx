import { MessageCircle, Truck } from "lucide-react";
import { ar } from "@/content/ar";
import { site } from "@/lib/site";
import { deliveryInquiryMessage, whatsappUrl } from "@/lib/whatsapp";
import { ButtonLink } from "@/components/ui/Button";

export function DeliverySection() {
  const t = ar.delivery;
  return (
    <section id="delivery" aria-labelledby="delivery-title" className="on-dark bg-primary py-14 text-stone-300 sm:py-20">
      <div className="container-page grid items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div>
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-surface-sand-strong">
            <Truck className="size-5" aria-hidden="true" />
            {t.eyebrow}
          </p>
          <h2 id="delivery-title" className="!text-white">
            {t.title}
          </h2>
          <p className="mt-4 max-w-xl text-lg leading-8">{t.text}</p>
          <p className="mt-2 max-w-xl text-sm text-stone-400">{t.note}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink
              href={whatsappUrl(site.phone.wa, deliveryInquiryMessage)}
              variant="whatsapp"
              size="lg"
              icon={<MessageCircle className="size-5" aria-hidden="true" />}
            >
              {t.cta}
            </ButtonLink>
            <ButtonLink href="/products" variant="inverse" size="lg">
              {t.browse}
            </ButtonLink>
          </div>
        </div>

        <ol className="grid gap-3">
          {t.steps.map((step, i) => (
            <li key={step} className="flex items-center gap-4 rounded-lg border border-white/10 bg-white/5 p-4">
              <span
                aria-hidden="true"
                className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-sand-strong font-heading text-xl font-bold text-primary"
              >
                {i + 1}
              </span>
              <span className="text-base font-semibold text-white">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
