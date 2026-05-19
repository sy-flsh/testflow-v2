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
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/common/empty-state";
import { DialogShell } from "@/components/common/dialog-shell";
import { FormField, TextAreaField, TextInput } from "@/components/common/form-field";
import type { Project, ProjectStatus } from "@/lib/domain/types";
import { projectStatusLabels as statusLabels } from "@/lib/domain/labels";
import {
  loadMockProjects,
  loadProjectBackupSnapshot,
  saveProjectBackupSnapshot,
} from "@/lib/mock/mock-store";
import { cn } from "@/lib/utils";

type ViewMode = "card" | "table";

const colorOptions = [
  "#2563EB",
  "#10B981",
  "#8B5CF6",
  "#F59E0B",
  "#EC4899",
  "#14B8A6",
  "#EF4444",
];

export function ProjectList() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>(() => {
    const snapshot = loadProjectBackupSnapshot();
    return snapshot?.projects ?? [];
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isBackupMode, setIsBackupMode] = useState(false);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");
  const [sortBy, setSortBy] = useState<"updated" | "name" | "created">(
    "updated",
  );
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  useEffect(() => {
    let active = true;

    async function loadProjects() {
      setIsLoading(true);
      setNotice("");
      setActionError("");

      try {
        const apiProjects = await requestData<Project[]>("/api/projects");

        if (!active) {
          return;
        }

        setProjects(apiProjects);
        saveProjectBackupSnapshot(apiProjects);
        setIsBackupMode(false);
      } catch {
        if (!active) {
          return;
        }

        const snapshot = loadProjectBackupSnapshot();

        if (snapshot) {
          setProjects(snapshot.projects);
          setIsBackupMode(true);
          setNotice(
            `백업 데이터 표시 중입니다. 마지막 백업: ${formatBackupTime(snapshot.savedAt)}`,
          );
          setActionError("");
        } else {
          const legacyFallback = loadMockProjects();
          setProjects(legacyFallback);
          setIsBackupMode(true);
          setNotice("API 연결에 실패해 기존 mock fallback 데이터를 표시 중입니다.");
          setActionError("");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadProjects();

    return () => {
      active = false;
    };
  }, []);

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

  async function handleCreate(input: {
    name: string;
    description: string;
    color: string;
  }) {
    setActionError("");

    try {
      const createdProject = await requestData<Project>("/api/projects", {
        method: "POST",
        body: JSON.stringify(input),
      });

      setProjects((currentProjects) => {
        const nextProjects = [
          createdProject,
          ...currentProjects.filter((project) => project.id !== createdProject.id),
        ];
        saveProjectBackupSnapshot(nextProjects);
        return nextProjects;
      });
      setIsBackupMode(false);
      setNotice("");
      setCreateOpen(false);
      return true;
    } catch (error) {
      setActionError(getErrorMessage(error));
      return false;
    }
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }

    setActionError("");

    try {
      await requestData<{ id: string }>(`/api/projects/${deleteTarget.id}`, {
        method: "DELETE",
      });

      setProjects((currentProjects) => {
        const nextProjects = currentProjects.filter(
          (project) => project.id !== deleteTarget.id,
        );
        saveProjectBackupSnapshot(nextProjects);
        return nextProjects;
      });
      setDeleteTarget(null);
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  }

  return (
    <>
      {(isLoading || isBackupMode || actionError) && (
        <div
          className={cn(
            "mb-4 rounded-lg border px-4 py-3 text-sm",
            actionError
              ? "border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger-text)]"
              : "border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]",
          )}
        >
          {isLoading
            ? "프로젝트 목록을 불러오는 중입니다."
            : actionError || notice}
        </div>
      )}

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
          submitError={actionError}
        />
      )}

      {deleteTarget && (
        <DeleteProjectDialog
          project={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          submitError={actionError}
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
  submitError,
}: {
  onClose: () => void;
  onSubmit: (input: {
    name: string;
    description: string;
    color: string;
  }) => Promise<boolean>;
  submitError?: string;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedColor, setSelectedColor] = useState(colorOptions[0]);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameError = submitted && name.trim().length === 0;

  async function submitProject() {
    setSubmitted(true);

    if (!name.trim()) {
      return;
    }

    setIsSubmitting(true);
    await onSubmit({
      name: name.trim(),
      description: description.trim(),
      color: selectedColor,
    });
    setIsSubmitting(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);

    if (!name.trim()) {
      return;
    }
    await submitProject();
  }

  return (
    <DialogShell
      title="새 프로젝트 만들기"
      description="프로젝트 정보를 입력해 DB에 추가합니다."
      onClose={onClose}
      maxWidth="max-w-lg"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={submitProject}
            disabled={isSubmitting}
            className="h-9 rounded-md bg-[var(--brand-primary)] px-3 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "생성 중..." : "프로젝트 생성"}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <FormField label="프로젝트 이름" required error={nameError ? "프로젝트 이름을 입력하세요." : undefined}>
          <TextInput
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={50}
            placeholder="예: 결제 시스템 v2"
          />
        </FormField>

        <FormField label="설명">
          <TextAreaField
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={200}
            rows={3}
            placeholder="프로젝트 설명을 입력하세요"
          />
        </FormField>

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
                  selectedColor === color ? "border-[var(--text-primary)]" : "border-white",
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

        {submitError && (
          <div className="rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger-text)]">
            {submitError}
          </div>
        )}
      </form>
    </DialogShell>
  );
}

function DeleteProjectDialog({
  project,
  onClose,
  onConfirm,
  submitError,
}: {
  project: Project;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  submitError?: string;
}) {
  return (
    <DialogShell
      title="프로젝트 삭제"
      description={
        <><span className="font-medium">{project.name}</span> 프로젝트를 삭제할까요?</>
      }
      onClose={onClose}
      maxWidth="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
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
      }
    >
      <div className="space-y-2 text-sm text-[var(--text-secondary)]">
        <p>이 작업은 DB의 프로젝트 레코드를 삭제합니다.</p>
        {submitError && (
          <p className="rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-[var(--danger-text)]">
            {submitError}
          </p>
        )}
      </div>
    </DialogShell>
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

async function requestData<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: T; error?: { message?: string } }
    | null;

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.error?.message || "API 요청에 실패했습니다.");
  }

  return payload.data;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "요청 처리 중 오류가 발생했습니다.";
}

function formatBackupTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "알 수 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
