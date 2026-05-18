"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function DrawerShell({
  title,
  description,
  onClose,
  children,
  footer,
  actions,
  className,
  widthClassName = "max-w-4xl",
}: {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  actions?: ReactNode;
  className?: string;
  widthClassName?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/20">
      <button type="button" className="flex-1 cursor-default" onClick={onClose} aria-label="닫기" />
      <aside className={cn("flex h-full w-full flex-col bg-white shadow-2xl", widthClassName, className)}>
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">{title}</h2>
            {description && <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>}
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-[var(--surface-muted)]"
              aria-label="Drawer 닫기"
            >
              <X className="tf-icon" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-[var(--border-subtle)] px-6 py-4">{footer}</div>}
      </aside>
    </div>
  );
}
