/**
 * Premium Motion Language — one shared system so every animation in the app feels like it belongs together.
 * Durations/easing follow the "Subtle"/"Standard" tiers of the ui-ux-pro-max motion database (hover 150-300ms,
 * scroll reveal 300-600ms, page transition 200-600ms) — never the "Complex" tier, which reads as showy rather
 * than premium. Transform/opacity only (GPU-friendly) — nothing here ever animates layout properties.
 *
 * `motion`/`react` (the framer-motion successor) is the ONE animation library used across the site; plain CSS
 * transitions (already in globals.css) remain for micro hovers that don't need JS. `prefers-reduced-motion` is
 * respected automatically by `motion` (useReducedMotion) and, belt-and-braces, by the global CSS override.
 */
import type { Transition, Variants } from "motion/react";

export const EASE_SOFT: Transition["ease"] = [0.22, 1, 0.36, 1]; // matches --primitive-motion-ease

export const DURATION = {
  fast: 0.18, // micro hovers, icon nudges
  base: 0.3, // standard entrances, filter reflow
  reveal: 0.6, // section/hero reveal, large imagery
} as const;

/** Fade + slight rise. The default entrance for cards, panels and section content. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE_SOFT } },
};

/** Larger reveal for hero-scale imagery / headlines. */
export const revealUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.reveal, ease: EASE_SOFT } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DURATION.base, ease: EASE_SOFT } },
};

/** Stagger a group of children (nav links, hero lines, grid cards) by a small, consistent offset. */
export function staggerContainer(stagger = 0.08, delayChildren = 0): Variants {
  return { hidden: {}, show: { transition: { staggerChildren: stagger, delayChildren } } };
}

/** Page-level fade/translate used by <PageTransition>. Subtle tier — no loading-screen feel. */
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE_SOFT } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.16, ease: EASE_SOFT } },
};
