import type { ReactNode } from "react";
import { TriangleAlert, SearchX } from "lucide-react";
import { ar } from "@/content/ar";
import { cn } from "@/lib/cn";

function StateShell({
  icon,
  title,
  text,
  children,
  tone,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  children?: ReactNode;
  tone?: "error";
}) {
  return (
    <div
      className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-lg border border-dashed border-line bg-surface px-6 py-12 text-center"
      role={tone === "error" ? "alert" : undefined}
    >
      <span className={cn("grid size-14 place-items-center rounded-full", tone === "error" ? "bg-error-bg text-error" : "bg-surface-sand text-accent-text")}>
        {icon}
      </span>
      <h2 className="!text-xl">{title}</h2>
      <p className="text-muted">{text}</p>
      {children && <div className="mt-2 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}

export function EmptyState({
  title = ar.products.noResultsTitle,
  text = ar.products.noResultsText,
  children,
}: {
  title?: string;
  text?: string;
  children?: ReactNode;
}) {
  return (
    <StateShell icon={<SearchX className="size-7" aria-hidden="true" />} title={title} text={text}>
      {children}
    </StateShell>
  );
}

export function ErrorState({
  title = ar.products.errorTitle,
  text = ar.products.errorText,
  children,
}: {
  title?: string;
  text?: string;
  children?: ReactNode;
}) {
  return (
    <StateShell tone="error" icon={<TriangleAlert className="size-7" aria-hidden="true" />} title={title} text={text}>
      {children}
    </StateShell>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-line-soft bg-surface" aria-hidden="true">
      <div className="skeleton aspect-[4/5]" />
      <div className="space-y-3 p-4">
        <div className="skeleton h-4 w-1/3 rounded" />
        <div className="skeleton h-5 w-3/4 rounded" />
        <div className="skeleton h-4 w-1/2 rounded" />
      </div>
    </div>
  );
}

export function LoadingState({ count = 8, label = ar.products.loading }: { count?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {Array.from({ length: count }, (_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
