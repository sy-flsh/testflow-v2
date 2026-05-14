import { cn } from "@/lib/utils";

const statusStyles = {
  passed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  failed: "bg-red-50 text-red-700 ring-red-200",
  blocked: "bg-amber-50 text-amber-700 ring-amber-200",
  skipped: "bg-slate-100 text-slate-700 ring-slate-200",
  pending: "bg-slate-100 text-slate-600 ring-slate-200",
  open: "bg-red-50 text-red-700 ring-red-200",
  in_progress: "bg-amber-50 text-amber-700 ring-amber-200",
  resolved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  closed: "bg-slate-100 text-slate-700 ring-slate-200",
};

export function StatusBadge({
  status,
  label,
}: {
  status: keyof typeof statusStyles;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ring-inset",
        statusStyles[status],
      )}
    >
      {label}
    </span>
  );
}
