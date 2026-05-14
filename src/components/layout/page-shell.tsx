import Link from "next/link";
import {
  BarChart3,
  Bug,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Settings,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/projects", label: "프로젝트", icon: FolderKanban },
  { href: "/settings", label: "설정", icon: Settings },
];

const projectItems = [
  { href: "/projects/demo/testcases", label: "테스트케이스", icon: FileText },
  { href: "/projects/demo/runs", label: "테스트실행", icon: BarChart3 },
  { href: "/projects/demo/bugs", label: "결함", icon: Bug },
];

export function PageShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--bg-subtle)]">
      <header className="fixed inset-x-0 top-0 z-10 flex h-14 items-center border-b border-[var(--border-default)] bg-white px-6">
        <Link href="/dashboard" className="text-base font-semibold">
          TestFlow
        </Link>
        <div className="ml-auto text-sm text-[var(--text-secondary)]">
          v0.1 scaffold
        </div>
      </header>

      <aside className="fixed bottom-0 left-0 top-14 w-60 border-r border-[var(--border-default)] bg-white p-4">
        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex h-9 items-center gap-2 rounded-md px-3 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-6 border-t border-[var(--border-default)] pt-4">
          <p className="mb-2 px-3 text-xs font-medium text-[var(--text-tertiary)]">
            프로젝트 예시
          </p>
          <nav className="space-y-1">
            {projectItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex h-9 items-center gap-2 rounded-md px-3 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </aside>

      <main className="pl-60 pt-14">
        <div className="mx-auto max-w-6xl px-8 py-8">
          <div className="mb-6">
            <p className="mb-2 text-sm text-[var(--text-tertiary)]">
              TestFlow v2
            </p>
            <h1 className="text-2xl font-semibold tracking-normal">{title}</h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {description}
            </p>
          </div>
          {children ?? <PlaceholderCard />}
        </div>
      </main>
    </div>
  );
}

function PlaceholderCard() {
  return (
    <section className="rounded-lg border border-[var(--border-default)] bg-white p-6">
      <p className="text-sm text-[var(--text-secondary)]">
        초기 scaffold placeholder입니다. 실제 도메인 기능은 후속 작업에서
        구현합니다.
      </p>
    </section>
  );
}
