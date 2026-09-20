"use client";

import { useId } from "react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-md border border-line bg-surface px-4 text-base text-text placeholder:text-muted/80 " +
  "transition-[border-color,box-shadow] duration-200 hover:border-secondary " +
  "aria-[invalid=true]:border-error aria-[invalid=true]:bg-error-bg/40 disabled:bg-surface-sand disabled:text-muted";

// Chevron on the inline-start side (left in RTL). Inline SVG keeps it dependency-free.
const selectArrow = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2357534E' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundPosition: "left 14px center",
  backgroundSize: "16px",
} as const;

interface FieldShellProps {
  id?: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  optionalLabel?: string;
  className?: string;
  children: (a11y: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}

/** Visible label + hint + inline error, wired with aria-describedby / aria-invalid. */
export function Field({ id: idProp, label, hint, error, required, optionalLabel, className, children }: FieldShellProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [errId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold text-text">
        {label}
        {required && (
          <span className="ms-1 text-error" aria-hidden="true">
            *
          </span>
        )}
        {!required && optionalLabel && <span className="ms-1 font-normal text-muted">{optionalLabel}</span>}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="text-sm font-medium text-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, "h-12", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(control, "h-12 appearance-none bg-no-repeat pe-4 ps-10", className)} style={selectArrow} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "min-h-24 py-3", className)} {...props} />;
}
