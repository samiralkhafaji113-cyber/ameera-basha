"use client";

import { useEffect, useRef, useState } from "react";
import { Link2, MessageCircle, Send, Share2 } from "lucide-react";
import { ar } from "@/content/ar";
import { Button } from "@/components/ui/Button";
import { FacebookIcon } from "@/components/ui/BrandIcons";
import { useToast } from "@/components/ui/Toast";

/**
 * Share UI. On phones it opens the native share sheet (Web Share API). Where that API does not exist
 * (desktop) the button expands inline into WhatsApp / Telegram / Facebook / copy-link – the "expandable share
 * button" idea from 21st.dev's Social Share Button, without its animation library (plain state, no extra JS deps).
 */
export function ShareButton({ name, path }: { name: string; path: string }) {
  const toast = useToast();
  const [panel, setPanel] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const url = () => new URL(path, window.location.origin).toString();

  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPanel(false);
    const onDown = (e: MouseEvent) => wrap.current && !wrap.current.contains(e.target as Node) && setPanel(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [panel]);

  async function onShare() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: ar.product.shareTitle(name), url: url() });
      } catch (err) {
        if ((err as DOMException)?.name !== "AbortError") toast.show(ar.product.shareFailed, "error");
      }
      return;
    }
    setPanel((v) => !v);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url());
      toast.show(ar.product.linkCopied);
    } catch {
      toast.show(ar.product.shareFailed, "error");
    }
    setPanel(false);
  }

  const title = ar.product.shareTitle(name);
  const item =
    "inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-text transition-colors hover:border-primary hover:bg-surface-sand";

  return (
    <div ref={wrap} className="flex flex-col gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={onShare}
        aria-expanded={panel}
        aria-controls="share-options"
        icon={<Share2 className="size-[18px]" aria-hidden="true" />}
      >
        {ar.product.share}
      </Button>
      {panel && (
        <ul id="share-options" aria-label={ar.product.share} className="flex flex-wrap gap-2">
          <li>
            <a
              className={item}
              target="_blank"
              rel="noopener noreferrer"
              href={`https://wa.me/?text=${encodeURIComponent(`${title} ${url()}`)}`}
              onClick={() => setPanel(false)}
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              WhatsApp
              <span className="sr-only"> – {ar.nav.opensNew}</span>
            </a>
          </li>
          <li>
            <a
              className={item}
              target="_blank"
              rel="noopener noreferrer"
              href={`https://t.me/share/url?url=${encodeURIComponent(url())}&text=${encodeURIComponent(title)}`}
              onClick={() => setPanel(false)}
            >
              <Send className="size-4" aria-hidden="true" />
              Telegram
              <span className="sr-only"> – {ar.nav.opensNew}</span>
            </a>
          </li>
          <li>
            <a
              className={item}
              target="_blank"
              rel="noopener noreferrer"
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url())}`}
              onClick={() => setPanel(false)}
            >
              <FacebookIcon className="size-4" />
              Facebook
              <span className="sr-only"> – {ar.nav.opensNew}</span>
            </a>
          </li>
          <li>
            <button type="button" className={item} onClick={copy}>
              <Link2 className="size-4" aria-hidden="true" />
              {ar.product.copyLink}
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
