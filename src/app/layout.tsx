import type { Viewport } from "next";
import type { Metadata } from "next";
import { Noto_Kufi_Arabic, Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { site } from "@/lib/site";
import { ToastProvider } from "@/components/ui/Toast";

// Fonts come from the ui-ux-pro-max google-fonts DB (Arabic subset). Headings: Noto Kufi Arabic – a geometric, mono-line Kufi that
// echoes the thin geometric Arabic/Latin lettering of the official logo. Body: Noto Sans Arabic (pairing #26 "Arabic Elegant" body).
const kufi = Noto_Kufi_Arabic({ subsets: ["arabic", "latin"], variable: "--font-kufi", display: "swap" });
const sans = Noto_Sans_Arabic({ subsets: ["arabic", "latin"], variable: "--font-noto-sans", display: "swap" });

// Root layout = document shell shared by the public site ((site) group) and the admin (/admin).
export const metadata: Metadata = { metadataBase: new URL(site.url) };

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#050505",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={site.locale} dir={site.dir} className={`${kufi.variable} ${sans.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
