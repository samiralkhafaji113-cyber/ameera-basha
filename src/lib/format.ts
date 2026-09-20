/** Iraqi dinar, Western digits (the store's own posts use Western digits, e.g. 26.500). */
export function formatPrice(value: number): string {
  return `${value.toLocaleString("en-US")} د.ع`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ar-IQ-u-nu-latn", { year: "numeric", month: "long", day: "numeric" });
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ar-IQ-u-nu-latn", { day: "numeric", month: "short", year: "numeric" });
}

export function formatAge(min: number, max: number): string {
  if (min > 0 && min < 1) return `من 6 أشهر إلى ${max} سنوات`;
  if (min === max) return `${max} سنة`;
  return `${min} – ${max} سنة`;
}
