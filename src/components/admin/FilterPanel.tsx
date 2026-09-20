"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";

/** Filters stay visible on wide screens; on phones they fold away so the list is the first thing you see. */
export function FilterPanel({ children, activeCount = 0, id }: { children: ReactNode; activeCount?: number; id: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="mb-3 inline-flex min-h-11 items-center gap-2 rounded-md border border-line bg-surface px-4 text-sm font-semibold md:hidden"
      >
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        بحث وتصفية
        {activeCount > 0 && <span className="grid size-5 place-items-center rounded-full bg-accent text-xs text-on-accent">{activeCount}</span>}
      </button>
      <div id={id} className={cn(open ? "block" : "hidden", "md:block")}>
        {children}
      </div>
    </div>
  );
}
