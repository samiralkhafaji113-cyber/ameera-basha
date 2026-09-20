import { SearchX } from "lucide-react";
import { ar } from "@/content/ar";
import { ButtonLink } from "@/components/ui/Button";
import { SiteChrome } from "@/components/layout/SiteChrome";

export default function NotFound() {
  return (
    <SiteChrome>
      <div className="container-page grid place-items-center py-24 text-center">
        <div className="flex max-w-md flex-col items-center gap-4">
          <span className="grid size-16 place-items-center rounded-full bg-surface-sand text-accent-text">
            <SearchX className="size-8" aria-hidden="true" />
          </span>
          <h1 className="!text-3xl">{ar.states.notFoundTitle}</h1>
          <p className="text-muted">{ar.states.notFoundText}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <ButtonLink href="/" variant="primary" size="lg">
              {ar.states.home}
            </ButtonLink>
            <ButtonLink href="/products" variant="secondary" size="lg">
              {ar.nav.products}
            </ButtonLink>
          </div>
        </div>
      </div>
    </SiteChrome>
  );
}
