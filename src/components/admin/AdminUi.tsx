import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/reservation-status";
import type { ReservationStatus } from "@/lib/reservation-status";
import type { ProductStatus } from "@/lib/validation/product";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="!text-[clamp(1.5rem,1.2rem+1.2vw,2rem)]">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className, actions }: { title?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={cn("rounded-lg border border-line-soft bg-surface p-4 shadow-card sm:p-5", className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="!text-lg">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const PRODUCT_STATUS: Record<ProductStatus, { label: string; tone: "success" | "neutral" | "warning" | "gold" }> = {
  published: { label: "منشور", tone: "success" },
  draft: { label: "مسودة", tone: "warning" },
  hidden: { label: "مخفي", tone: "neutral" },
  archived: { label: "مؤرشف", tone: "gold" },
};

export function ProductStatusBadge({ status, trashed }: { status: ProductStatus; trashed?: boolean }) {
  if (trashed) return <Badge tone="error">محذوف</Badge>;
  const s = PRODUCT_STATUS[status] ?? PRODUCT_STATUS.draft;
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{STATUS_LABEL[status] ?? status}</Badge>;
}

export function AdminEmpty({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line bg-surface px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-surface-sand text-accent-text">
        <Inbox className="size-7" aria-hidden="true" />
      </span>
      <h2 className="!text-lg">{title}</h2>
      {text && <p className="max-w-sm text-sm text-muted">{text}</p>}
      {children && <div className="mt-2 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="overflow-hidden rounded-lg border border-line-soft bg-surface">
      <span className="sr-only">جاري التحميل…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-line-soft p-4 last:border-b-0" aria-hidden="true">
          <div className="skeleton size-12 rounded" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-1/2 rounded" />
            <div className="skeleton h-3 w-1/4 rounded" />
          </div>
          <div className="skeleton hidden h-6 w-16 rounded-full sm:block" />
        </div>
      ))}
    </div>
  );
}

/** Server-rendered pagination: plain links, so it works without JS and keeps filters in the URL. */
export function Pagination({ page, pageSize, total, hrefFor }: { page: number; pageSize: number; total: number; hrefFor: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const link = "inline-flex min-h-10 min-w-10 items-center justify-center gap-1 rounded-md border border-line bg-surface px-3 text-sm font-semibold transition-colors hover:border-primary hover:bg-surface-warm";
  return (
    <nav aria-label="الصفحات" className="mt-4 flex items-center justify-between gap-3">
      <p className="text-sm text-muted">
        صفحة <span className="font-semibold tabular-nums text-text">{page}</span> من <span className="tabular-nums">{pages}</span> · <span className="tabular-nums">{total}</span> نتيجة
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className={link} rel="prev">
            <ChevronRight className="size-4" aria-hidden="true" />
            السابق
          </Link>
        ) : null}
        {page < pages ? (
          <Link href={hrefFor(page + 1)} className={link} rel="next">
            التالي
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("ar-IQ", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Baghdad", numberingSystem: "latn" }).format(new Date(iso));
}
