import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ar } from "@/content/ar";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label={ar.product.breadcrumbs} className="text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={item.label} className="flex items-center gap-1.5">
              {item.href && !last ? (
                <Link href={item.href} className="rounded underline-offset-4 hover:text-text hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={last ? "font-semibold text-text" : undefined}>
                  {item.label}
                </span>
              )}
              {!last && <ChevronLeft className="size-4 shrink-0 ltr:rotate-180" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
