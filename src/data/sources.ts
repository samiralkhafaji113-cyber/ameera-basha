import type { SocialId } from "./social";
import type { ProductSource } from "../types/product";

/** Where a product came from → label + icon. Extend when a new ingest source is added. */
export const SOURCE_META: Record<Exclude<ProductSource, "manual">, { label: string; icon: SocialId }> = {
  telegram: { label: "Telegram", icon: "telegram" },
  facebook: { label: "Facebook", icon: "facebook" },
  instagram: { label: "Instagram", icon: "instagram" },
  tiktok: { label: "TikTok", icon: "tiktok" },
};

/** Products entered by hand in the admin have no external source, so no source badge/link is shown. */
export const sourceMeta = (source: ProductSource) => (source === "manual" ? null : SOURCE_META[source]);
