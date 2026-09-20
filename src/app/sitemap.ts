import type { MetadataRoute } from "next";
import { getProductRepository } from "@/lib/catalog";
import { site } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getProductRepository().list();
  return [
    { url: site.url, changeFrequency: "weekly", priority: 1 },
    { url: `${site.url}/products`, changeFrequency: "daily", priority: 0.9 },
    ...products.map((p) => ({
      url: `${site.url}/products/${p.slug}`,
      lastModified: new Date(p.postedAt),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
