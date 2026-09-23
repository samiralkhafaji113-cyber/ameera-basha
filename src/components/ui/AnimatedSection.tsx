"use client";

import type { ElementType, ReactNode } from "react";
import { motion } from "motion/react";
import { fadeUp, revealUp, staggerContainer } from "@/lib/motion";

/**
 * Scroll-reveal wrapper: fades + rises into view once, the first time it enters the viewport (viewport-margin
 * pulls the trigger a little early so it never feels laggy). Used around homepage sections, not everywhere —
 * per the brief, only Hero / major sections / promotional blocks / selected product sections should move.
 */
export function AnimatedSection({
  children,
  as: Component = motion.div,
  className,
  variant = "up",
  stagger = false,
  delay = 0,
}: {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  /** "up" = standard fade-rise (default); "reveal" = larger rise for hero-scale content. */
  variant?: "up" | "reveal";
  /** When true, direct children with a `variants={fadeUp}` (or default) get staggered in sequence. */
  stagger?: boolean;
  delay?: number;
}) {
  const MotionComponent = Component;
  const base = variant === "reveal" ? revealUp : fadeUp;
  const variants = stagger ? staggerContainer(0.08, delay) : { hidden: base.hidden, show: { ...base.show, transition: { ...(base.show as { transition?: object }).transition, delay } } };

  return (
    <MotionComponent
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "0px 0px -80px 0px" }}
      variants={variants}
    >
      {children}
    </MotionComponent>
  );
}

/** A direct child of a `stagger` AnimatedSection — inherits the fade-up entrance and its place in the sequence. */
export function AnimatedItem({ children, className, as: Component = motion.div }: { children: ReactNode; className?: string; as?: ElementType }) {
  const MotionComponent = Component;
  return (
    <MotionComponent className={className} variants={fadeUp}>
      {children}
    </MotionComponent>
  );
}
