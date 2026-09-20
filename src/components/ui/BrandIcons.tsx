import { MessageCircle, PhoneCall, Send } from "lucide-react";
import type { SVGProps } from "react";
import type { SocialId } from "@/data/social";

/** lucide-react ships no brand marks, so the three we need are drawn inline (simple monochrome glyphs). */
export function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M13.5 21v-7.5h2.6l.4-3.1h-3V8.5c0-.9.3-1.5 1.6-1.5h1.5V4.2c-.3 0-1.2-.2-2.3-.2-2.3 0-3.9 1.4-3.9 4v1.4H8v3.1h2.4V21h3.1Z" />
    </svg>
  );
}

export function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TikTokIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M16.6 3h-3.1v12.2a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.5a5.7 5.7 0 1 0 4.9 5.6V9.4c1 .7 2.2 1.1 3.5 1.1V7.4c-1.9-.1-3.4-1.7-3.5-4.4Z" />
    </svg>
  );
}

/** One icon per channel id – the single place that maps a channel to its glyph. */
export function SocialIcon({ id, className = "size-5" }: { id: SocialId; className?: string }) {
  switch (id) {
    case "facebook":
      return <FacebookIcon className={className} />;
    case "instagram":
      return <InstagramIcon className={className} />;
    case "tiktok":
      return <TikTokIcon className={className} />;
    case "telegram":
      return <Send className={className} aria-hidden="true" />;
    case "whatsapp":
      return <MessageCircle className={className} aria-hidden="true" />;
    case "viber":
      return <PhoneCall className={className} aria-hidden="true" />;
  }
}
