import { sameAsUrls } from "@/data/social";
import { absoluteUrl, site } from "@/lib/site";
import type { Product } from "@/types/product";

/** Only verified facts. No opening hours, ratings, price range or branch count – none were provided. */
export function localBusinessSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "ClothingStore",
    name: site.nameAr,
    alternateName: site.nameEn,
    description: site.description,
    ...(site.hasCanonicalUrl ? { url: site.url } : {}),
    image: `${site.url}/og.jpg`,
    logo: `${site.url}/brand/logo-lockup-black.png`,
    telephone: site.phone.e164,
    address: {
      "@type": "PostalAddress",
      streetAddress: `${site.address.street} – ${site.address.landmark}`,
      addressLocality: site.address.city,
      addressRegion: site.address.region,
      addressCountry: site.address.countryCode,
    },
    geo: { "@type": "GeoCoordinates", latitude: site.geo.lat, longitude: site.geo.lng },
    hasMap: site.links.maps,
    areaServed: { "@type": "Country", name: site.address.country },
    // Only owner-supplied or independently verified channels (TikTok is "probable" → excluded, see src/data/social.ts)
    sameAs: sameAsUrls(),
  };
}

/** Product schema without `offers`: currency/stock were not stated explicitly by the source. */
export function productSchema(p: Product) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    category: p.categoryName,
    image: p.images.map((i) => absoluteUrl(i.src)),
    ...(p.description ? { description: p.description } : {}),
  };
}
