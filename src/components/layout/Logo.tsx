import Image from "next/image";
import Link from "next/link";
import { ar } from "@/content/ar";
import { cn } from "@/lib/cn";

/**
 * The OFFICIAL logo (owner-supplied). Files in /public/brand are technical variants only
 * (crop + luminance→alpha, see scripts/build-brand-assets.mjs) – never redrawn or re-proportioned.
 *  - `black` variant for light backgrounds, `white` for dark ones.
 *  - `mark` = the AB monogram alone (official crop) for very small placements.
 */
export type LogoVariant = "lockup" | "mark";

const SRC = {
  lockup: { black: "/brand/logo-lockup-black.png", white: "/brand/logo-lockup-white.png", width: 277, height: 368 },
  mark: { black: "/brand/logo-mark-black.png", white: "/brand/logo-mark-white.png", width: 277, height: 272 },
} as const;

export function LogoImage({
  variant = "lockup",
  inverse,
  className,
  preload,
}: {
  variant?: LogoVariant;
  inverse?: boolean;
  className?: string;
  preload?: boolean;
}) {
  const s = SRC[variant];
  return (
    <Image
      src={inverse ? s.white : s.black}
      alt={`${ar.brand.name} – ${ar.brand.en}`}
      width={s.width}
      height={s.height}
      preload={preload}
      className={cn("w-auto select-none", className)}
    />
  );
}

export function Logo({ inverse, className, imageClassName, preload = false }: { inverse?: boolean; className?: string; imageClassName?: string; preload?: boolean }) {
  return (
    <Link href="/" className={cn("inline-flex items-center", className)}>
      <LogoImage inverse={inverse} className={imageClassName ?? "h-14"} preload={preload} />
      <span className="sr-only"> – {ar.nav.home}</span>
    </Link>
  );
}
