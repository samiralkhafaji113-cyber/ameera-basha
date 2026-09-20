import type { Metadata } from "next";
import type { ReactNode } from "react";

// The admin is private: never indexed, no social previews. (proxy.ts also sends X-Robots-Tag and no-store.)
export const metadata: Metadata = {
  title: { default: "لوحة التحكم", template: "%s | لوحة التحكم" },
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return children;
}
