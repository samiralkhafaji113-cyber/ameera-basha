import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const tones = {
  neutral: "bg-surface-sand text-secondary",
  gold: "bg-surface-sand-strong text-accent-text",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  error: "bg-error-bg text-error",
  dark: "bg-primary text-on-primary",
} as const;

export function Badge({
  tone = "neutral",
  icon,
  children,
  className,
}: {
  tone?: keyof typeof tones;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold leading-5",
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
