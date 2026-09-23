"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutGrid, List, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { fadeUp } from "@/lib/motion";
import { ar } from "@/content/ar";
import { AGE_BUCKETS, PRICE_BUCKETS, SIZE_LABELS } from "@/data/categories";
import { cn } from "@/lib/cn";
import { collectSizeOptions, countByCategory, filterProducts } from "@/lib/search";
import type { AgeBucketId, Category, CategoryId, PriceBucketId, Product, SortKey } from "@/types/product";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/States";
import { ProductCard } from "./ProductCard";

const PAGE_SIZE = 24;
const SORTS: SortKey[] = ["newest", "price-asc", "price-desc"];

const pick = <T extends string>(value: string | null, allowed: readonly T[]): T | undefined =>
  value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;

export function ProductBrowser({ products, categories }: { products: Product[]; categories: Category[] }) {
  const t = ar.products;
  const pathname = usePathname();
  const params = useSearchParams();

  // Filters live in the URL (shareable / back-button friendly); the search box is local for instant typing.
  const category = pick(params.get("category"), categories.map((c) => c.id));
  const subcategory = category
    ? pick(params.get("subcategory"), categories.find((c) => c.id === category)!.subcategories.map((s) => s.id))
    : undefined;
  const age = pick(params.get("age"), AGE_BUCKETS.map((b) => b.id) as AgeBucketId[]);
  const price = pick(params.get("price"), PRICE_BUCKETS.map((b) => b.id) as PriceBucketId[]);
  const size = params.get("size") ?? undefined;
  const sort = pick(params.get("sort"), SORTS) ?? "newest";
  const view = params.get("view") === "list" ? "list" : "grid";

  const [q, setQ] = useState(params.get("q") ?? "");
  const deferredQ = useDeferredValue(q);
  const [panelOpen, setPanelOpen] = useState(false);

  const sizeOptions = useMemo(() => collectSizeOptions(products), [products]);

  const filters = useMemo(
    () => ({ q: deferredQ, category, subcategory, age, size, price, sort }),
    [deferredQ, category, subcategory, age, size, price, sort],
  );
  const results = useMemo(() => filterProducts(products, filters), [products, filters]);
  // Chip counts ignore the category itself but respect every other active filter (live, like the 21st.dev chips)
  const counts = useMemo(
    () => countByCategory(products, { q: filters.q, age: filters.age, size: filters.size, price: filters.price }),
    [products, filters],
  );

  const key = JSON.stringify(filters);
  const [pager, setPager] = useState({ key, count: PAGE_SIZE });
  const count = pager.key === key ? pager.count : PAGE_SIZE;
  const shown = results.slice(0, count);

  /** Native history API is integrated with Next's useSearchParams – no navigation / re-fetch. */
  function update(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if ("category" in patch) next.delete("subcategory");
    const qs = next.toString();
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  }

  const activeCount = [subcategory, age, size, price].filter(Boolean).length + (sort !== "newest" ? 1 : 0);
  const anyFilter = Boolean(category || activeCount || q.trim());

  function reset() {
    setQ("");
    window.history.replaceState(null, "", pathname);
  }

  const activeCategory = categories.find((c) => c.id === category);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-lg border border-line-soft bg-surface p-4 shadow-card sm:p-5">
        <form role="search" onSubmit={(e) => e.preventDefault()}>
          <label htmlFor="product-search" className="sr-only">
            {t.searchLabel}
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden="true" />
            <Input
              id="product-search"
              type="text"
              inputMode="search"
              name="q"
              enterKeyHint="search"
              autoComplete="off"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                update({ q: e.target.value.trim() || undefined });
              }}
              placeholder={t.searchPlaceholder}
              className="px-12"
            />
            {q && (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  update({ q: undefined });
                  document.getElementById("product-search")?.focus();
                }}
                aria-label={t.clearSearch}
                className="absolute end-1.5 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-muted transition-colors hover:bg-surface-sand hover:text-text"
              >
                <X className="size-[18px]" aria-hidden="true" />
              </button>
            )}
          </div>
        </form>

        {/* Category chips with live counts + running total – pattern adapted from the 21st.dev "Role Filter Chips" (cnippet.dev).
            The original uses Radix Toggle; native buttons with aria-pressed give the same semantics with no extra dependency. */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-secondary">
              <SlidersHorizontal className="size-3.5" aria-hidden="true" />
              {t.filterByCategory}
            </span>
            <span className="flex items-center gap-1.5">
              <span role="status" aria-live="polite" className="text-sm font-semibold text-muted">
                {t.resultCount(results.length)}
              </span>
              {anyFilter && (
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex min-h-11 items-center gap-1 rounded px-2 text-sm font-semibold text-accent-text underline-offset-4 hover:underline"
                >
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                  {t.clear}
                </button>
              )}
            </span>
          </div>

          <div role="group" aria-label={t.category} className="flex flex-wrap gap-2">
            {[
              { id: undefined as CategoryId | undefined, name: t.all, n: counts.total },
              ...categories.map((c) => ({ id: c.id as CategoryId | undefined, name: c.shortName ?? c.name, n: counts.byCategory[c.id] ?? 0 })),
            ].map((c) => {
              const active = c.id === category;
              return (
                <button
                  key={c.id ?? "all"}
                  type="button"
                  aria-pressed={active}
                  disabled={c.n === 0 && !active}
                  onClick={() => update({ category: c.id })}
                  className={cn(
                    "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border ps-4 pe-2.5 text-sm font-semibold transition-colors duration-200",
                    "disabled:cursor-not-allowed disabled:border-line-soft disabled:text-muted disabled:opacity-60",
                    active ? "border-primary bg-primary text-on-primary" : "border-line bg-surface text-text hover:border-primary hover:bg-surface-warm",
                  )}
                >
                  {c.name}
                  <span
                    className={cn(
                      "grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs font-bold tabular-nums",
                      active ? "bg-white/20 text-on-primary" : "bg-surface-sand text-secondary",
                    )}
                  >
                    {c.n}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 md:justify-end">
          <Button
            className="md:hidden"
            variant="secondary"
            size="sm"
            aria-expanded={panelOpen}
            aria-controls="filter-panel"
            onClick={() => setPanelOpen((v) => !v)}
            icon={<SlidersHorizontal className="size-[18px]" aria-hidden="true" />}
          >
            {t.filters}
            {activeCount > 0 && (
              <span className="grid size-5 place-items-center rounded-full bg-accent text-xs text-on-accent">{activeCount}</span>
            )}
          </Button>
        <div className="flex rounded-md border border-line bg-surface p-0.5" role="group" aria-label={t.viewLabel}>
          {(
            [
              { id: "grid", label: t.gridView, Icon: LayoutGrid },
              { id: "list", label: t.listView, Icon: List },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              aria-label={label}
              title={label}
              onClick={() => update({ view: id === "grid" ? undefined : id })}
              className={cn(
                "grid size-10 place-items-center rounded transition-colors",
                view === id ? "bg-primary text-on-primary" : "text-muted hover:bg-surface-sand hover:text-text",
              )}
            >
              <Icon className="size-[18px]" aria-hidden="true" />
            </button>
          ))}
        </div>
        </div>

        <div id="filter-panel" className={cn("grid-cols-2 gap-3 md:grid md:grid-cols-3 lg:grid-cols-5", panelOpen ? "grid" : "hidden")}>
          {activeCategory && (
            <Field label={t.subcategory}>
              {(a) => (
                <Select id={a.id} value={subcategory ?? ""} onChange={(e) => update({ subcategory: e.target.value || undefined })}>
                  <option value="">{t.all}</option>
                  {activeCategory.subcategories.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          <Field label={t.age} hint={age ? t.ageHint : undefined}>
            {(a) => (
              <Select id={a.id} value={age ?? ""} onChange={(e) => update({ age: e.target.value || undefined })} aria-describedby={a.describedBy}>
                <option value="">{t.all}</option>
                {AGE_BUCKETS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t.size} hint={size ? t.sizeHint : undefined}>
            {(a) => (
              <Select id={a.id} value={size ?? ""} onChange={(e) => update({ size: e.target.value || undefined })} aria-describedby={a.describedBy}>
                <option value="">{t.all}</option>
                {sizeOptions.map((s) => (
                  <option key={s} value={s}>
                    {SIZE_LABELS[s] ?? s}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t.price} hint={price ? t.priceHint : undefined}>
            {(a) => (
              <Select id={a.id} value={price ?? ""} onChange={(e) => update({ price: e.target.value || undefined })} aria-describedby={a.describedBy}>
                <option value="">{t.all}</option>
                {PRICE_BUCKETS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label} د.ع
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t.sort}>
            {(a) => (
              <Select id={a.id} value={sort} onChange={(e) => update({ sort: e.target.value === "newest" ? undefined : e.target.value })}>
                {SORTS.map((s) => (
                  <option key={s} value={s}>
                    {t.sortOptions[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </div>

      <h2 className="sr-only">{t.resultsHeading}</h2>
      {results.length === 0 ? (
        <EmptyState>
          <div className="flex w-full flex-col items-center gap-3">
            <p className="text-sm font-semibold text-secondary">{t.tryInstead}</p>
            <ul className="flex flex-wrap justify-center gap-2">
              {ar.hero.popularTerms.map((term) => (
                <li key={term}>
                  <button
                    type="button"
                    onClick={() => {
                      setQ(term);
                      update({ q: term });
                    }}
                    className="inline-flex h-11 items-center rounded-full border border-line bg-surface px-4 text-sm font-semibold text-text transition-colors hover:border-primary hover:bg-surface-sand"
                  >
                    {term}
                  </button>
                </li>
              ))}
            </ul>
            <Button variant="primary" onClick={reset} icon={<RotateCcw className="size-4" aria-hidden="true" />}>
              {t.reset}
            </Button>
          </div>
        </EmptyState>
      ) : (
        <>
          <ul className={cn("grid gap-3 sm:gap-5", view === "list" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-2 lg:grid-cols-4")}>
            <AnimatePresence initial={false} mode="popLayout">
              {shown.map((p, i) => (
                <motion.li
                  key={p.id}
                  layout
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
                  variants={fadeUp}
                  className="flex min-w-0"
                >
                  <div className="flex min-w-0 flex-1">
                    <ProductCard product={p} view={view} preload={i < 2} />
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {shown.length < results.length && (
            <div className="flex justify-center">
              <Button variant="secondary" size="lg" onClick={() => setPager({ key, count: count + PAGE_SIZE })}>
                {t.loadMore} ({results.length - shown.length})
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
