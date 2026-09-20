import type { Metadata } from "next";
import { site } from "@/lib/site";
import { SiteChrome } from "@/components/layout/SiteChrome";

// Site-wide SEO defaults apply to the public pages only – the admin has its own (noindex) metadata.
export const metadata: Metadata = {
  title: { default: site.title, template: `%s | ${site.nameAr}` },
  description: site.description,
  applicationName: site.nameAr,
  alternates: { canonical: "/" },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    locale: "ar_IQ",
    siteName: site.nameAr,
    title: site.title,
    description: site.description,
    url: "/",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "منتجات من مجمع أميرة باشا – الحلة" }],
  },
  twitter: { card: "summary_large_image", title: site.title, description: site.description, images: ["/og.jpg"] },
};

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return <SiteChrome>{children}</SiteChrome>;
}
