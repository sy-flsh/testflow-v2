import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BaseFieldProps = {
  label: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

export function FormField({
  label,
  helperText,
  error,
  required,
  className,
  children,
}: BaseFieldProps) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-sm font-semibold text-[var(--text-primary)]">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      {children}
      {helperText && !error && <span className="mt-1 block text-xs text-[var(--text-tertiary)]">{helperText}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export function TextInput({
  className,
  prefix,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { prefix?: ReactNode }) {
  return (
    <div
      className={cn(
        "flex h-10 overflow-hidden rounded-md border border-[var(--border-subtle)] bg-white focus-within:border-[var(--brand-primary)] focus-within:ring-2 focus-within:ring-blue-100",
        className,
      )}
    >
      {prefix && (
        <span className="inline-flex items-center border-r border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-sm text-[var(--text-tertiary)]">
          {prefix}
        </span>
      )}
      <input {...props} className="min-w-0 flex-1 px-3 text-sm outline-none" />
    </div>
  );
}

export function SelectField({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "h-10 w-full rounded-md border border-[var(--border-subtle)] bg-white px-3 text-sm outline-none focus:border-[var(--brand-primary)]",
        className,
      )}
    >
      {children}
    </select>
  );
}

export function TextAreaField({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full resize-none rounded-md border border-[var(--border-subtle)] bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-blue-100",
        className,
      )}
    />
  );
}

