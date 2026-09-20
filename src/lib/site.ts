/**
 * Single source of truth for business facts. Only facts supplied by the owner or present on the
 * store's own public pages are here. Anything else is deliberately absent (opening hours, prices of
 * delivery, branch count, ratings …) – see the report "Missing Information".
 */
// Production/Preview on Vercel: NEXT_PUBLIC_SITE_URL is the public domain. A Preview deployment without it falls back to its own
// *.vercel.app address so canonical/OG URLs never point at localhost or at production.
const rawUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const site = {
  nameAr: "مجمع أميرة باشا",
  nameEn: "Ameera Basha Complex",
  locale: "ar",
  dir: "rtl",
  url: rawUrl.replace(/\/$/, ""),
  /** false until NEXT_PUBLIC_SITE_URL is set – then schema.org `url` is omitted instead of pointing at localhost. */
  hasCanonicalUrl: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
  title: "مجمع أميرة باشا | ملابس نسائية وأطفال وملابس مدرسية وقرطاسية – الحلة",
  description:
    "مجمع أميرة باشا في الحلة – بابل: ملابس نسائية، ملابس أطفال، أزياء مدرسية وقرطاسية. حجز القطع والتوصيل إلى جميع المحافظات العراقية. تواصل عبر واتساب أو الهاتف 07811404047.",
  phone: {
    display: "07811404047",
    e164: "+9647811404047",
    /** International digits without "+" (wa.me format). */
    wa: "9647811404047",
  },
  address: {
    country: "العراق",
    countryCode: "IQ",
    region: "بابل",
    city: "الحلة",
    street: "شارع الجمعية",
    landmark: "مقابل نافورة الجمعية",
    line: "محافظة بابل – الحلة – شارع الجمعية – مقابل نافورة الجمعية",
  },
  geo: { lat: 32.470232, lng: 44.4144853 },
  links: {
    facebook: "https://www.facebook.com/amerabasha2/",
    telegram: "https://t.me/ameera_bashaa",
    maps: "https://maps.app.goo.gl/rw2rfbCTCGu8zMyi7",
    mapsEmbed: "https://www.google.com/maps?q=32.470232,44.4144853&hl=ar&z=17&output=embed",
  },
} as const;

export const telHref = `tel:${site.phone.e164}`;
export const viberHref = `viber://chat?number=%2B${site.phone.wa}`;

/** Product images now live in Supabase Storage (absolute URLs); bundled assets are site-relative. */
export const absoluteUrl = (src: string): string =>
  /^https?:\/\//.test(src) ? src : `${site.url}${src.startsWith("/") ? "" : "/"}${src}`;

