/**
 * Social / messaging channels.
 *
 * Every entry records HOW it was verified (see `verification`). Nothing here is invented:
 *  - "owner"    → URL/number supplied by the project owner.
 *  - "verified" → found independently AND the account itself shows the store's own facts
 *                 (same phone number + same address + link to the official Facebook page).
 *  - "probable" → account identity matches (name, branch, street hashtags) but it does not show the
 *                 phone number or an explicit link back to the official pages. Shown on the site,
 *                 but not asserted as `sameAs` in structured data. The owner should confirm it.
 *
 * To hide a channel, delete its entry (or set `url` to null) – every component reads from here.
 */
export type SocialId = "facebook" | "instagram" | "tiktok" | "telegram" | "whatsapp" | "viber";
export type VerificationStatus = "owner" | "verified" | "probable";

export interface SocialChannel {
  id: SocialId;
  name: string;
  url: string | null;
  /** Short, factual description shown on the social section. */
  blurb: string;
  verification: { status: VerificationStatus; evidence: string; checkedAt: string };
}

const CHECKED = "2026-09-20";

export const SOCIAL: SocialChannel[] = [
  {
    id: "facebook",
    name: "Facebook",
    url: "https://www.facebook.com/amerabasha2/",
    blurb: "صفحة المجمع",
    verification: { status: "owner", evidence: "URL supplied by the owner; the page name reads «مجمع اميرة باشا».", checkedAt: CHECKED },
  },
  {
    id: "instagram",
    name: "Instagram",
    url: "https://www.instagram.com/ameera.baasha/",
    blurb: "صور وفيديوهات المجمع",
    verification: {
      status: "verified",
      evidence:
        "Profile «مجمع أميرة باشا» (@ameera.baasha): bio contains the store phone 07811404047 and the address «حله شارع الجمعيه مقابيل النافورة»; profile links to facebook.com/amerabasha2.",
      checkedAt: CHECKED,
    },
  },
  {
    id: "tiktok",
    name: "TikTok",
    url: "https://www.tiktok.com/@ameera_baasha",
    blurb: "فيديوهات قصيرة من المجمع",
    verification: {
      status: "probable",
      evidence:
        "Profile «مجمع اميرة باشا» (@ameera_baasha): videos tagged «#مجمع_أميره_باشا_فرع_بابل #حله_شارع_الجمعيه». Phone number / explicit link back to the official Facebook page NOT seen – owner should confirm.",
      checkedAt: CHECKED,
    },
  },
  {
    id: "telegram",
    name: "Telegram",
    url: "https://t.me/ameera_bashaa",
    blurb: "قناة المنتجات",
    verification: { status: "owner", evidence: "URL supplied by the owner; channel «مجمع أميره باشا فرع بابل» – the source of the catalog.", checkedAt: CHECKED },
  },
];

export const socialLinks = (): (SocialChannel & { url: string })[] =>
  SOCIAL.filter((s): s is SocialChannel & { url: string } => Boolean(s.url));

export const socialById = (id: SocialId) => socialLinks().find((s) => s.id === id);

/** Only owner-supplied or independently verified channels may be asserted in structured data. */
export const sameAsUrls = (): string[] => socialLinks().filter((s) => s.verification.status !== "probable").map((s) => s.url);
