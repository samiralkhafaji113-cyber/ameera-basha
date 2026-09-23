import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  id,
  inverse,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  id?: string;
  inverse?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-4", className)}>
      <div className="max-w-2xl">
        {eyebrow && (
          <p className={cn("label-editorial mb-3 flex items-center gap-2.5", inverse ? "text-surface-sand-strong" : "text-accent-text")}>
            <span aria-hidden="true" className={cn("h-px w-8", inverse ? "bg-surface-sand-strong" : "bg-accent")} />
            {eyebrow}
          </p>
        )}
        <h2 id={id} className={cn("!text-[clamp(1.875rem,1.4rem+2.2vw,3rem)] !tracking-[-0.015em]", inverse && "!text-white")}>
          {title}
        </h2>
        {description && <p className={cn("mt-3 text-base", inverse ? "text-stone-300" : "text-muted")}>{description}</p>}
      </div>
      {action}
    </div>
  );
}
