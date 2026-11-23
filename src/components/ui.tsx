"use client";

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes
} from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: ReactNode;
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-school-600 text-white shadow-sm shadow-school-600/20 hover:bg-school-700 focus-visible:ring-school-500",
  secondary:
    "bg-white text-slate-800 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus-visible:ring-school-500",
  outline:
    "bg-transparent text-school-700 ring-1 ring-inset ring-school-300 hover:bg-school-50 focus-visible:ring-school-500",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  danger: "bg-rose-600 text-white shadow-sm hover:bg-rose-700 focus-visible:ring-rose-500"
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", loading = false, icon, children, disabled, type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
        VARIANTS[variant],
        className
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "block w-full rounded-lg border-0 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 transition focus:ring-2 focus:ring-inset focus:ring-school-500",
          className
        )}
        {...props}
      />
    );
  }
);

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "block w-full appearance-none rounded-lg border-0 bg-white px-3.5 py-2.5 pr-9 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 transition focus:ring-2 focus:ring-inset focus:ring-school-500",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({
  htmlFor,
  children,
  hint
}: {
  htmlFor?: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-slate-800">
        {children}
      </label>
      {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} hint={hint}>
        {label}
      </Label>
      {children}
      {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white shadow-card",
        className
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  description,
  actions
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-5 py-5", className)}>{children}</div>;
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-left transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span>
        ) : null}
      </span>
      <span
        className={cn(
          "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-school-600" : "bg-slate-300"
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </span>
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin text-school-600", className)} />;
}

export function Badge({
  children,
  tone = "slate"
}: {
  children: ReactNode;
  tone?: "slate" | "blue" | "green" | "amber";
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    blue: "bg-school-50 text-school-800 ring-school-200",
    green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200"
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-school-50 text-school-600">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {description ? <p className="mt-1.5 text-sm leading-6 text-slate-600">{description}</p> : null}
        {children}
        {footer ? <div className="mt-6 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}
