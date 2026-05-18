"use client";

import {
  CheckCircle,
  FileText,
  FolderKanban,
  Grid3X3,
  List,
  MoreVertical,
  Plus,
  Search,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/common/empty-state";
import { cn } from "@/lib/utils";

type ProjectStatus = "active" | "completed" | "archived";
type ViewMode = "card" | "table";

type Project = {
  id: string;
  name: string;
  description: string;
  color: string;
  status: ProjectStatus;
  progress: number;
  testCaseCount: number;
  passCount: number;
  failCount: number;
  members: string[];
  updatedAtLabel: string;
  createdAtOrder: number;
};

const statusLabels: Record<ProjectStatus, string> = {
  active: "진행중",
  completed: "완료",
  archived: "보관됨",
};

const colorOptions = [
  "#2563EB",
  "#10B981",
  "#8B5CF6",
  "#F59E0B",
  "#EC4899",
  "#14B8A6",
  "#EF4444",
];

const initialProjects: Project[] = [
  {
    id: "demo-project",
    name: "결제 시스템 v2",
    description: "결제 모듈 개편",
    color: "#2563EB",
    status: "active",
    progress: 72,
    testCaseCount: 145,
    passCount: 89,
    failCount: 5,
    members: ["홍", "김", "이", "박", "최", "정"],
    updatedAtLabel: "2시간 전",
    createdAtOrder: 9,
  },
  {
    id: "signup-flow",
    name: "회원가입 플로우",
    description: "신규 가입 개선",
    color: "#10B981",
    status: "active",
    progress: 95,
    testCaseCount: 56,
    passCount: 53,
    failCount: 1,
    members: ["김", "이", "박"],
    updatedAtLabel: "어제",
    createdAtOrder: 8,
  },
  {
    id: "checkout-improvement",
    name: "체크아웃 개선",
    description: "장바구니 UX",
    color: "#8B5CF6",
    status: "active",
    progress: 30,
    testCaseCount: 42,
    passCount: 12,
    failCount: 0,
    members: ["홍", "최"],
    updatedAtLabel: "3시간 전",
    createdAtOrder: 7,
  },
  {
    id: "mobile-app-v3",
    name: "모바일 앱 v3",
    description: "iOS/Android 동시",
    color: "#F59E0B",
    status: "active",
    progress: 60,
    testCaseCount: 88,
    passCount: 50,
    failCount: 3,
    members: ["홍", "김", "박", "최"],
    updatedAtLabel: "5시간 전",
    createdAtOrder: 6,
  },
  {
    id: "admin-console",
    name: "관리자 페이지",
    description: "내부 도구 개편",
    color: "#EC4899",
    status: "active",
    progress: 15,
    testCaseCount: 23,
    passCount: 3,
    failCount: 1,
    members: ["이", "박"],
    updatedAtLabel: "1일 전",
    createdAtOrder: 5,
  },
  {
    id: "notification-system",
    name: "알림 시스템",
    description: "Push/SMS 통합",
    color: "#14B8A6",
    status: "completed",
    progress: 100,
    testCaseCount: 34,
    passCount: 34,
    failCount: 0,
    members: ["홍", "김", "이"],
    updatedAtLabel: "2일 전",
    createdAtOrder: 4,
  },
  {
    id: "api-v2-migration",
    name: "API v2 마이그레이션",
    description: "REST에서 GraphQL 전환",
    color: "#EF4444",
    status: "active",
    progress: 45,
    testCaseCount: 67,
    passCount: 28,
    failCount: 2,
    members: ["박", "최", "정"],
    updatedAtLabel: "4시간 전",
    createdAtOrder: 3,
  },
  {
    id: "search-rebuild",
    name: "검색 기능 개편",
    description: "Elasticsearch 도입",
    color: "#CA8A04",
    status: "active",
    progress: 80,
    testCaseCount: 39,
    passCount: 30,
    failCount: 1,
    members: ["홍", "정"],
    updatedAtLabel: "6시간 전",
    createdAtOrder: 2,
  },
  {
    id: "dark-mode",
    name: "다크모드 도입",
    description: "전체 UI 다크 테마",
    color: "#64748B",
    status: "archived",
    progress: 25,
    testCaseCount: 18,
    passCount: 4,
    failCount: 0,
    members: ["김", "최"],
    updatedAtLabel: "1일 전",
    createdAtOrder: 1,
  },
];

export function ProjectList() {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");
  const [sortBy, setSortBy] = useState<"updated" | "name" | "created">(
    "updated",
  );
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const visibleProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return projects
      .filter((project) => {
        const matchesQuery =
          !normalizedQuery ||
          project.name.toLowerCase().includes(normalizedQuery) ||
          project.description.toLowerCase().includes(normalizedQuery);
        const matchesStatus =
          statusFilter === "all" || project.status === statusFilter;

        return matchesQuery && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === "name") {
          return a.name.localeCompare(b.name, "ko");
        }

        if (sortBy === "created") {
          return b.createdAtOrder - a.createdAtOrder;
        }

        return b.createdAtOrder - a.createdAtOrder;
      });
  }, [projects, query, sortBy, statusFilter]);

  function handleCreate(input: {
    name: string;
    description: string;
    color: string;
  }) {
    const id = toProjectId(input.name);
    const nextProject: Project = {
      id,
      name: input.name,
      description: input.description || "새 프로젝트 설명",
      color: input.color,
      status: "active",
      progress: 0,
      testCaseCount: 0,
      passCount: 0,
      failCount: 0,
      members: ["홍"],
      updatedAtLabel: "방금 전",
      createdAtOrder: projects.length + 1,
    };

    setProjects((current) => [nextProject, ...current]);
    setCreateOpen(false);
  }

  function handleDelete() {
    if (!deleteTarget) {
      return;
    }

    setProjects((current) =>
      current.filter((project) => project.id !== deleteTarget.id),
    );
    setDeleteTarget(null);
  }

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 rounded-lg border border-[var(--border-default)] bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 md:flex-row">
          <label className="relative block min-w-64 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-9 w-full rounded-md border border-[var(--border-default)] bg-white pl-9 pr-3 text-sm outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-primary)]"
              placeholder="프로젝트 이름 검색..."
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as ProjectStatus | "all")
            }
            className="h-9 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm text-[var(--text-secondary)] outline-none focus:border-[var(--brand-primary)]"
          >
            <option value="all">전체 상태</option>
            <option value="active">진행중</option>
            <option value="completed">완료</option>
            <option value="archived">보관됨</option>
          </select>

          <select
            value={sortBy}
            onChange={(event) =>
              setSortBy(event.target.value as "updated" | "name" | "created")
            }
            className="h-9 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm text-[var(--text-secondary)] outline-none focus:border-[var(--brand-primary)]"
          >
            <option value="updated">최근 수정</option>
            <option value="name">이름순</option>
            <option value="created">생성일</option>
          </select>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex h-9 rounded-md border border-[var(--border-default)] bg-white p-1">
            <ViewToggleButton
              active={viewMode === "card"}
              label="카드 보기"
              onClick={() => setViewMode("card")}
            >
              <Grid3X3 className="h-4 w-4" />
            </ViewToggleButton>
            <ViewToggleButton
              active={viewMode === "table"}
              label="테이블 보기"
              onClick={() => setViewMode("table")}
            >
              <List className="h-4 w-4" />
            </ViewToggleButton>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--brand-primary)] px-3 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)]"
          >
            <Plus className="h-4 w-4" />새 프로젝트
          </button>
        </div>
      </div>

      {visibleProjects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="조건에 맞는 프로젝트가 없습니다"
          description="검색어나 상태 필터를 조정하거나 새 프로젝트를 만들어보세요."
        />
      ) : viewMode === "card" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onOpen={() => router.push(`/projects/${project.id}/testcases`)}
              onDelete={() => setDeleteTarget(project)}
            />
          ))}
        </div>
      ) : (
        <ProjectTable
          projects={visibleProjects}
          onOpen={(project) => router.push(`/projects/${project.id}/testcases`)}
          onDelete={setDeleteTarget}
        />
      )}

      {isCreateOpen && (
        <CreateProjectDialog
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreate}
        />
      )}

      {deleteTarget && (
        <DeleteProjectDialog
          project={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}

function ProjectCard({
  project,
  onOpen,
  onDelete,
}: {
  project: Project;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const extraMemberCount = Math.max(project.members.length - 3, 0);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          onOpen();
        }
      }}
      className="rounded-lg border border-[var(--border-default)] bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-md"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: project.color }}
            />
            <h2 className="truncate text-base font-semibold">{project.name}</h2>
          </div>
          <p className="mt-2 truncate text-sm text-[var(--text-secondary)]">
            {project.description}
          </p>
        </div>
        <button
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--text-tertiary)] hover:bg-[var(--danger-bg)] hover:text-[var(--danger-text)]"
          aria-label={`${project.name} 삭제`}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <span>{statusLabels[project.status]}</span>
          <span>{project.progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-muted)]">
          <div
            className="h-full rounded-full bg-[var(--brand-primary)]"
            style={{ width: `${project.progress}%` }}
          />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2 text-sm text-[var(--text-secondary)]">
        <StatItem icon={FileText} value={project.testCaseCount} label="TC" />
        <StatItem icon={CheckCircle} value={project.passCount} label="Pass" />
        <StatItem icon={XCircle} value={project.failCount} label="Fail" />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {project.members.slice(0, 3).map((member, index) => (
            <span
              key={`${project.id}-${member}-${index}`}
              className="-ml-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[var(--bg-muted)] text-xs font-medium text-[var(--text-secondary)] first:ml-0"
            >
              {member}
            </span>
          ))}
          {extraMemberCount > 0 && (
            <span className="ml-1 text-xs text-[var(--text-secondary)]">
              +{extraMemberCount}
            </span>
          )}
        </div>
        <span className="text-xs text-[var(--text-tertiary)]">
          {project.updatedAtLabel}
        </span>
      </div>
    </article>
  );
}

function ProjectTable({
  projects,
  onOpen,
  onDelete,
}: {
  projects: Project[];
  onOpen: (project: Project) => void;
  onDelete: (project: Project) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border-default)] bg-white">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-[var(--bg-subtle)] text-left text-[var(--text-secondary)]">
          <tr>
            <th className="px-4 py-3 font-medium">프로젝트</th>
            <th className="px-4 py-3 font-medium">상태</th>
            <th className="px-4 py-3 font-medium">진행률</th>
            <th className="px-4 py-3 font-medium">TC</th>
            <th className="px-4 py-3 font-medium">Pass</th>
            <th className="px-4 py-3 font-medium">Fail</th>
            <th className="px-4 py-3 font-medium">최근 수정</th>
            <th className="w-12 px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr
              key={project.id}
              onClick={() => onOpen(project)}
              className="cursor-pointer border-t border-[var(--border-default)] hover:bg-[var(--bg-subtle)]"
            >
              <td className="px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{project.name}</p>
                    <p className="truncate text-xs text-[var(--text-secondary)]">
                      {project.description}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-[var(--text-secondary)]">
                {statusLabels[project.status]}
              </td>
              <td className="px-4 py-3">{project.progress}%</td>
              <td className="px-4 py-3">{project.testCaseCount}</td>
              <td className="px-4 py-3">{project.passCount}</td>
              <td className="px-4 py-3">{project.failCount}</td>
              <td className="px-4 py-3 text-[var(--text-secondary)]">
                {project.updatedAtLabel}
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(project);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-tertiary)] hover:bg-[var(--danger-bg)] hover:text-[var(--danger-text)]"
                  aria-label={`${project.name} 삭제`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CreateProjectDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: { name: string; description: string; color: string }) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedColor, setSelectedColor] = useState(colorOptions[0]);
  const [submitted, setSubmitted] = useState(false);
  const nameError = submitted && name.trim().length === 0;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);

    if (!name.trim()) {
      return;
    }

    onSubmit({
      name: name.trim(),
      description: description.trim(),
      color: selectedColor,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-lg border border-[var(--border-default)] bg-white shadow-xl"
      >
        <div className="flex h-14 items-center justify-between border-b border-[var(--border-default)] px-5">
          <h2 className="text-base font-semibold">새 프로젝트 만들기</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-tertiary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <label className="block text-sm font-medium">
            프로젝트 이름 <span className="text-[var(--status-fail)]">*</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={50}
              className={cn(
                "mt-2 h-10 w-full rounded-md border px-3 text-sm outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-primary)]",
                nameError
                  ? "border-[var(--status-fail)]"
                  : "border-[var(--border-default)]",
              )}
              placeholder="예: 결제 시스템 v2"
            />
            {nameError && (
              <span className="mt-1 block text-xs text-[var(--status-fail)]">
                프로젝트 이름을 입력하세요.
              </span>
            )}
          </label>

          <label className="block text-sm font-medium">
            설명
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={200}
              rows={3}
              className="mt-2 w-full resize-none rounded-md border border-[var(--border-default)] px-3 py-2 text-sm outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-primary)]"
              placeholder="프로젝트 설명을 입력하세요"
            />
          </label>

          <div>
            <p className="mb-2 text-sm font-medium">컬러 라벨</p>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={cn(
                    "h-8 w-8 rounded-full border-2",
                    selectedColor === color
                      ? "border-[var(--text-primary)]"
                      : "border-white",
                  )}
                  style={{ backgroundColor: color }}
                  aria-label={`${color} 라벨 선택`}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">멤버 초대</p>
            <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-tertiary)]">
              멤버 초대는 후속 Phase에서 연결합니다.
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--border-default)] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
          >
            취소
          </button>
          <button
            type="submit"
            className="h-9 rounded-md bg-[var(--brand-primary)] px-3 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)]"
          >
            프로젝트 생성
          </button>
        </div>
      </form>
    </div>
  );
}

function DeleteProjectDialog({
  project,
  onClose,
  onConfirm,
}: {
  project: Project;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4">
      <div className="w-full max-w-md rounded-lg border border-[var(--border-default)] bg-white shadow-xl">
        <div className="border-b border-[var(--border-default)] px-5 py-4">
          <h2 className="text-base font-semibold">프로젝트 삭제</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            <span className="font-medium">{project.name}</span> 프로젝트를 mock
            목록에서 삭제할까요?
          </p>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4">
          <button
            onClick={onClose}
            className="h-9 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="h-9 rounded-md bg-[var(--status-fail)] px-3 text-sm font-medium text-white hover:bg-red-600"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

function ViewToggleButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-7 w-8 items-center justify-center rounded text-[var(--text-secondary)]",
        active && "bg-[var(--bg-muted)] text-[var(--text-primary)]",
      )}
      aria-label={label}
    >
      {children}
    </button>
  );
}

function StatItem({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-4 w-4 text-[var(--text-tertiary)]" />
      <span className="font-medium text-[var(--text-primary)]">{value}</span>
      <span className="text-xs">{label}</span>
    </div>
  );
}

function toProjectId(name: string) {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || `project-${Date.now()}`;
}
