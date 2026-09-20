"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { ar } from "@/content/ar";
import type { Product } from "@/types/product";
import { Button } from "@/components/ui/Button";
import type { ButtonSize, ButtonVariant } from "@/components/ui/Button";

// The dialog (form + validation) is only downloaded when someone actually starts a reservation.
const ReservationDialog = dynamic(() => import("./ReservationDialog").then((m) => m.ReservationDialog), { ssr: false });

export function ReserveButton({
  product,
  variant = "primary",
  size = "sm",
  className,
  label = ar.product.reserve,
}: {
  product: Product;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <Button
        ref={triggerRef}
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        icon={<MessageCircle className="size-[18px]" aria-hidden="true" />}
      >
        {label}
      </Button>
      {open && (
        <ReservationDialog
          product={product}
          onClose={() => {
            setOpen(false);
            requestAnimationFrame(() => triggerRef.current?.focus()); // return focus to the trigger
          }}
        />
      )}
    </>
  );
}
