"use client";

import type { ComponentType } from "react";
import {
  BarChart3,
  Bug,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Play,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const workspaceNav = [
  { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/projects", label: "프로젝트", icon: FolderKanban },
];

const projectNav = [
  {
    href: "/projects/demo-project/testcases",
    label: "테스트케이스",
    icon: FileText,
  },
  { href: "/projects/demo-project/runs", label: "테스트실행", icon: Play },
  { href: "/projects/demo-project/bugs", label: "결함", icon: Bug },
  { href: "/projects/demo-project/reports", label: "보고서", icon: BarChart3 },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed bottom-0 left-0 top-14 z-20 flex w-60 flex-col border-r border-[var(--border-default)] bg-white">
      <div className="flex-1 overflow-y-auto p-3">
        <SidebarSection items={workspaceNav} pathname={pathname} />

        <div className="my-4 border-t border-[var(--border-default)]" />

        <p className="mb-2 px-3 text-xs font-medium text-[var(--text-tertiary)]">
          프로젝트 컨텍스트
        </p>
        <SidebarSection items={projectNav} pathname={pathname} />
      </div>

      <div className="border-t border-[var(--border-default)] p-3">
        <SidebarLink
          href="/settings"
          label="워크스페이스 설정"
          icon={Settings}
          active={pathname === "/settings"}
        />
      </div>
    </aside>
  );
}

function SidebarSection({
  items,
  pathname,
}: {
  items: Array<{
    href: string;
    label: string;
    icon: ComponentType<{ className?: string }>;
  }>;
  pathname: string;
}) {
  return (
    <nav className="space-y-1">
      {items.map((item) => (
        <SidebarLink
          key={item.href}
          href={item.href}
          label={item.label}
          icon={item.icon}
          active={isActive(pathname, item.href)}
        />
      ))}
    </nav>
  );
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
        active
          ? "bg-[var(--bg-muted)] text-[var(--text-primary)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]",
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </Link>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/projects") {
    return pathname === "/projects";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
