"use client";

/**
 * Shared, accessible UI primitives.
 *
 * These replace the copy-pasted toggle/button/spinner/badge markup that was
 * duplicated across the admin panels, chat, and shell. Centralising them keeps
 * the Tripanza light palette consistent and the a11y attributes correct
 * in one place.
 */

import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/* ─────────────────────────────  Spinner  ───────────────────────────── */

export function Spinner({
  size = 16,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      role="status"
      aria-label="Memuat"
      style={{ width: size, height: size }}
      className={
        "inline-block rounded-full border-2 border-slate-300 border-t-brand-600 animate-spin " +
        className
      }
    />
  );
}

/* ─────────────────────────────  Toggle  ───────────────────────────── */

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer " +
        (checked ? "bg-brand-600" : "bg-slate-200")
      }
    >
      <span
        className={
          "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 " +
          (checked ? "translate-x-6" : "translate-x-1")
        }
      />
    </button>
  );
}

/* ─────────────────────────────  Button  ───────────────────────────── */

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variantClasses: Record<Variant, string> = {
  // Cobalt primary buttons keep white text legible on the light theme.
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 shadow-md shadow-brand-600/20 active:scale-[0.98]",
  secondary:
    "bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-300",
  ghost: "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50",
  danger: "bg-rose-600 text-white hover:bg-rose-700 active:scale-[0.98]",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", loading = false, icon, children, className = "", disabled, ...rest },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={
          "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed " +
          variantClasses[variant] +
          " " +
          className
        }
        {...rest}
      >
        {loading ? <Spinner size={16} /> : icon}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

/* ───────────────────────────  StatusBadge  ─────────────────────────── */

export type ConvStatus = "bot" | "waiting" | "active" | "resolved" | "hold";

const statusMeta: Record<ConvStatus, { label: string; chip: string; dot: string }> = {
  active: {
    label: "Active",
    chip: "bg-brand-600/10 text-brand-700 border-brand-600/25",
    dot: "bg-brand-700",
  },
  waiting: {
    label: "Waiting",
    chip: "bg-rose-500/10 text-rose-700 border-rose-500/25",
    dot: "bg-rose-400",
  },
  bot: {
    label: "Bot",
    chip: "bg-sky-500/10 text-sky-700 border-sky-500/25",
    dot: "bg-sky-400",
  },
  resolved: {
    label: "Resolved",
    chip: "bg-slate-300/10 text-slate-600 border-stone-500/25",
    dot: "bg-slate-300",
  },
  hold: {
    label: "Ditahan",
    chip: "bg-orange-500/10 text-orange-700 border-orange-500/25",
    dot: "bg-orange-400",
  },
};

export function StatusBadge({
  status,
  pulse = false,
}: {
  status: ConvStatus | string;
  pulse?: boolean;
}) {
  const meta = statusMeta[(status as ConvStatus)] || statusMeta.bot;
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-semibold " +
        meta.chip
      }
    >
      <span
        className={
          "h-1.5 w-1.5 rounded-full " + meta.dot + (pulse ? " animate-pulse-dot" : "")
        }
      />
      {meta.label}
    </span>
  );
}

export { statusMeta };
