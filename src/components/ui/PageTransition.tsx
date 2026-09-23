"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { pageTransition } from "@/lib/motion";

/**
 * Subtle fade/translate between route changes — no loading screen, no layout shift (the outgoing page is
 * absolutely positioned only while exiting, then unmounted). Wraps <main>'s content in SiteChrome.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={pathname} variants={pageTransition} initial="initial" animate="animate" exit="exit">
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
