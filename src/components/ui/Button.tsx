import Link from "next/link";
import type { AnchorHTMLAttributes, ComponentPropsWithRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "accent" | "secondary" | "whatsapp" | "ghost" | "inverse";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "group inline-flex items-center justify-center gap-2 rounded-md font-semibold leading-none whitespace-nowrap select-none " +
  "transition-[background-color,color,box-shadow,transform,border-color] duration-200 ease-soft " +
  "active:translate-y-px disabled:pointer-events-none disabled:opacity-55";

const iconWrap = "inline-flex transition-transform duration-200 ease-soft group-hover:scale-110";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover hover:shadow-card",
  accent: "bg-accent text-on-accent hover:bg-accent-hover hover:shadow-card",
  secondary: "border border-line bg-surface text-text hover:border-primary hover:bg-surface-warm",
  whatsapp: "bg-whatsapp text-white hover:bg-whatsapp-hover hover:shadow-card",
  ghost: "text-text hover:bg-surface-sand",
  inverse: "bg-white text-primary hover:bg-surface-sand",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-10 px-4 text-sm",
  md: "h-12 px-6 text-[0.9375rem]",
  lg: "h-14 px-7 text-base",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra?: string) {
  return cn(base, variants[variant], sizes[size], extra);
}

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Button({
  variant,
  size,
  icon,
  className,
  children,
  type = "button",
  ...rest
}: CommonProps & Omit<ComponentPropsWithRef<"button">, keyof CommonProps>) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} {...rest}>
      {icon && <span className={iconWrap}>{icon}</span>}
      {children}
    </button>
  );
}

const isExternal = (href: string) => /^(https?:|tel:|viber:|mailto:)/.test(href);

export function ButtonLink({
  href,
  variant,
  size,
  icon,
  className,
  children,
  ...rest
}: CommonProps & { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps | "href">) {
  const cls = buttonClass(variant, size, className);
  if (isExternal(href)) {
    const web = href.startsWith("http");
    return (
      <a href={href} className={cls} {...(web ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...rest}>
        {icon && <span className={iconWrap}>{icon}</span>}
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} {...rest}>
      {icon && <span className={iconWrap}>{icon}</span>}
      {children}
    </Link>
  );
}
