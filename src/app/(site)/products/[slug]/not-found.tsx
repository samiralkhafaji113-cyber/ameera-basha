import { PackageX } from "lucide-react";
import { ar } from "@/content/ar";
import { ButtonLink } from "@/components/ui/Button";

export default function ProductNotFound() {
  return (
    <div className="container-page grid place-items-center py-20 text-center">
      <div className="flex max-w-md flex-col items-center gap-4">
        <span className="grid size-16 place-items-center rounded-full bg-surface-sand text-accent-text">
          <PackageX className="size-8" aria-hidden="true" />
        </span>
        <h1 className="!text-3xl">{ar.product.notFoundTitle}</h1>
        <p className="text-muted">{ar.product.notFoundText}</p>
        <ButtonLink href="/products" variant="primary" size="lg">
          {ar.product.backToProducts}
        </ButtonLink>
      </div>
    </div>
  );
}
