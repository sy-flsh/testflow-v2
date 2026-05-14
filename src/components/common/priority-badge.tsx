import { cn } from "@/lib/utils";

const priorityStyles = {
  high: "border-red-200 text-red-700",
  medium: "border-amber-200 text-amber-700",
  low: "border-slate-200 text-slate-600",
};

export function PriorityBadge({
  priority,
  label,
}: {
  priority: keyof typeof priorityStyles;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full border bg-white px-2.5 text-xs font-medium",
        priorityStyles[priority],
      )}
    >
      {label}
    </span>
  );
}
