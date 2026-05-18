import { Bell, ChevronDown, Search } from "lucide-react";
import Link from "next/link";

export function TopHeader() {
  return (
    <header className="tf-top-header fixed inset-x-0 top-0 z-30 flex h-14 items-center border-b border-[var(--border-default)] bg-white px-4 md:px-5">
      <Link
        href="/dashboard"
        className="tf-link-reset flex shrink-0 items-center gap-2"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--brand-primary)] text-sm font-semibold text-white">
          TF
        </span>
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          TestFlow
        </span>
      </Link>

      <button className="ml-4 hidden h-8 shrink-0 items-center gap-2 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] sm:flex lg:ml-6">
        Demo Workspace
        <ChevronDown className="tf-icon h-4 w-4 text-[var(--text-tertiary)]" />
      </button>

      <div className="mx-auto hidden w-full max-w-md px-4 md:block">
        <label className="relative block">
          <Search className="tf-icon pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            className="h-9 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] pl-9 pr-3 text-sm outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-primary)] focus:bg-white"
            placeholder="검색..."
          />
        </label>
      </div>

      <div className="ml-auto flex items-center gap-2 md:ml-6 md:gap-3">
        <button
          className="flex h-9 w-9 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
          aria-label="알림"
        >
          <Bell className="tf-icon h-4 w-4" />
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-secondary)] text-xs font-semibold text-white">
          홍
        </div>
      </div>
    </header>
  );
}
