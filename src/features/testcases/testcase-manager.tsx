"use client";

import {
  CheckCircle2,
  Download,
  FileText,
  Folder,
  MoreVertical,
  Paperclip,
  Plus,
  Search,
  Tag,
  Upload,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { PriorityBadge } from "@/components/common/priority-badge";
import type { Priority, TestCase, TestCaseStatus as TcStatus, TestFolder } from "@/lib/domain/types";
import {
  priorityLabels,
  testCaseStatusLabels as statusLabels,
} from "@/lib/domain/labels";
import { mockTestFolders } from "@/lib/mock/mock-data";
import { loadMockTestCases, saveMockTestCases } from "@/lib/mock/mock-store";
import { cn } from "@/lib/utils";

type Draft = {
  id?: string;
  title: string;
  priority: Priority;
  folderId: string;
  tagsText: string;
  description: string;
  preconditions: string;
  stepsText: string;
  expectedResult: string;
};

const folders: TestFolder[] = mockTestFolders;

export function TestCaseManager() {
  const [testCases, setTestCases] = useState(() => loadMockTestCases());
  const [selectedFolderId, setSelectedFolderId] = useState("all");
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<TcStatus | "all">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drawerDraft, setDrawerDraft] = useState<Draft | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isUploadOpen, setUploadOpen] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState(false);

  const allTags = useMemo(
    () => Array.from(new Set(testCases.flatMap((tc) => tc.tags))).sort(),
    [testCases],
  );

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = { all: testCases.length };

    for (const folder of folders) {
      if (folder.id !== "all") {
        counts[folder.id] = testCases.filter((tc) =>
          isInFolder(tc.folderId, folder.id),
        ).length;
      }
    }

    return counts;
  }, [testCases]);

  const visibleTestCases = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return testCases.filter((tc) => {
      const matchesFolder =
        selectedFolderId === "all" || isInFolder(tc.folderId, selectedFolderId);
      const matchesQuery =
        !normalizedQuery ||
        tc.id.toLowerCase().includes(normalizedQuery) ||
        tc.title.toLowerCase().includes(normalizedQuery);
      const matchesTag = tagFilter === "all" || tc.tags.includes(tagFilter);
      const matchesStatus =
        statusFilter === "all" || tc.status === statusFilter;

      return matchesFolder && matchesQuery && matchesTag && matchesStatus;
    });
  }, [query, selectedFolderId, statusFilter, tagFilter, testCases]);

  const allVisibleSelected =
    visibleTestCases.length > 0 &&
    visibleTestCases.every((tc) => selectedIds.includes(tc.id));

  function openNewDrawer() {
    setSubmitted(false);
    setDrawerDraft({
      title: "",
      priority: "medium",
      folderId: selectedFolderId === "all" ? "payment-checkout" : selectedFolderId,
      tagsText: "",
      description: "",
      preconditions: "",
      stepsText: "",
      expectedResult: "",
    });
  }

  function openEditDrawer(tc: TestCase) {
    setSubmitted(false);
    setDrawerDraft({
      id: tc.id,
      title: tc.title,
      priority: tc.priority,
      folderId: tc.folderId,
      tagsText: tc.tags.join(", "),
      description: tc.description,
      preconditions: tc.preconditions,
      stepsText: tc.steps.join("\n"),
      expectedResult: tc.expectedResult,
    });
  }

  function saveDrawerDraft() {
    if (!drawerDraft) {
      return;
    }

    setSubmitted(true);

    if (!drawerDraft.title.trim()) {
      return;
    }

    const tags = drawerDraft.tagsText
      .split(",")
      .map((tag) => tag.trim().replace(/^#/, ""))
      .filter(Boolean);
    const steps = drawerDraft.stepsText
      .split("\n")
      .map((step) => step.trim())
      .filter(Boolean);

    if (drawerDraft.id) {
      const nextTestCases = testCases.map((tc) =>
        tc.id === drawerDraft.id
          ? {
              ...tc,
              title: drawerDraft.title.trim(),
              priority: drawerDraft.priority,
              folderId: drawerDraft.folderId,
              tags,
              description: drawerDraft.description,
              preconditions: drawerDraft.preconditions,
              steps,
              expectedResult: drawerDraft.expectedResult,
              updatedAtLabel: "방금 전",
            }
          : tc,
      );
      setTestCases(nextTestCases);
      saveMockTestCases(nextTestCases);
    } else {
      const nextIndex = testCases.length + 1;
      const nextId = `TC-${String(nextIndex).padStart(3, "0")}`;

      const nextTestCases: TestCase[] = [
        {
          id: nextId,
          title: drawerDraft.title.trim(),
          priority: drawerDraft.priority,
          status: "draft" as const,
          folderId: drawerDraft.folderId,
          tags,
          author: "홍길동",
          updatedAtLabel: "방금 전",
          description: drawerDraft.description,
          preconditions: drawerDraft.preconditions,
          steps,
          expectedResult: drawerDraft.expectedResult,
        },
        ...testCases,
      ];
      setTestCases(nextTestCases);
      saveMockTestCases(nextTestCases);
    }

    setDrawerDraft(null);
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !visibleTestCases.some((tc) => tc.id === id)),
      );
      return;
    }

    setSelectedIds((current) =>
      Array.from(new Set([...current, ...visibleTestCases.map((tc) => tc.id)])),
    );
  }

  function deleteSelected() {
    const nextTestCases = testCases.filter((tc) => !selectedIds.includes(tc.id));
    setTestCases(nextTestCases);
    saveMockTestCases(nextTestCases);
    setSelectedIds([]);
  }

  function addTagToSelected() {
    const nextTestCases = testCases.map((tc) =>
        selectedIds.includes(tc.id) && !tc.tags.includes("bulk")
          ? { ...tc, tags: [...tc.tags, "bulk"], updatedAtLabel: "방금 전" }
          : tc,
    );
    setTestCases(nextTestCases);
    saveMockTestCases(nextTestCases);
  }

  function moveSelectedFolder() {
    const nextTestCases = testCases.map((tc) =>
        selectedIds.includes(tc.id)
          ? { ...tc, folderId: "payment-checkout", updatedAtLabel: "방금 전" }
          : tc,
    );
    setTestCases(nextTestCases);
    saveMockTestCases(nextTestCases);
  }

  return (
    <>
      <div className="mb-5 rounded-lg border border-[var(--border-default)] bg-white p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-1 flex-col gap-3 md:flex-row">
            <label className="relative block min-w-64 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-9 w-full rounded-md border border-[var(--border-default)] bg-white pl-9 pr-3 text-sm outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-primary)]"
                placeholder="테스트케이스 검색..."
              />
            </label>

            <select
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
              className="h-9 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm text-[var(--text-secondary)] outline-none focus:border-[var(--brand-primary)]"
            >
              <option value="all">전체 태그</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  #{tag}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as TcStatus | "all")
              }
              className="h-9 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm text-[var(--text-secondary)] outline-none focus:border-[var(--brand-primary)]"
            >
              <option value="all">전체 상태</option>
              <option value="ready">Ready</option>
              <option value="draft">Draft</option>
              <option value="deprecated">Deprecated</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setUploadOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--brand-primary)] bg-blue-50 px-3 text-sm font-medium text-[var(--brand-primary)] hover:bg-blue-100"
            >
              <Upload className="h-4 w-4" />
              엑셀 업로드
            </button>
            <button
              onClick={() => {
                setDownloadNotice(true);
                window.setTimeout(() => setDownloadNotice(false), 2200);
              }}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
            >
              <Download className="h-4 w-4" />
              다운로드
            </button>
            <button
              onClick={openNewDrawer}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--brand-primary)] px-3 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)]"
            >
              <Plus className="h-4 w-4" />새 테스트케이스
            </button>
          </div>
        </div>
        {downloadNotice && (
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            다운로드 기능은 후속 단계에서 실제 파일 생성과 연결합니다.
          </p>
        )}
      </div>

      <div className="grid min-h-[560px] grid-cols-1 overflow-hidden rounded-lg border border-[var(--border-default)] bg-white lg:grid-cols-[240px_minmax(0,1fr)]">
        <FolderTree
          selectedFolderId={selectedFolderId}
          counts={folderCounts}
          onSelect={(folderId) => {
            setSelectedFolderId(folderId);
            setSelectedIds([]);
          }}
        />

        <section className="min-w-0 border-t border-[var(--border-default)] lg:border-l lg:border-t-0">
          {selectedIds.length > 0 && (
            <div className="flex items-center justify-between border-b border-[var(--border-default)] bg-blue-50 px-4 py-3">
              <p className="text-sm font-medium text-[var(--brand-primary)]">
                {selectedIds.length}개 선택됨
              </p>
              <div className="flex items-center gap-2">
                <BulkButton onClick={deleteSelected}>삭제</BulkButton>
                <BulkButton onClick={addTagToSelected}>태그 추가</BulkButton>
                <BulkButton onClick={moveSelectedFolder}>폴더 이동</BulkButton>
              </div>
            </div>
          )}

          {visibleTestCases.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={FileText}
                title="조건에 맞는 테스트케이스가 없습니다"
                description="폴더, 검색어, 태그, 상태 필터를 조정하거나 새 테스트케이스를 만들어보세요."
              />
            </div>
          ) : (
            <TestCaseTable
              testCases={visibleTestCases}
              selectedIds={selectedIds}
              allSelected={allVisibleSelected}
              onToggleAll={toggleAllVisible}
              onToggle={toggleSelection}
              onOpen={openEditDrawer}
            />
          )}
        </section>
      </div>

      {drawerDraft && (
        <TestCaseDrawer
          draft={drawerDraft}
          submitted={submitted}
          onChange={setDrawerDraft}
          onClose={() => setDrawerDraft(null)}
          onSave={saveDrawerDraft}
        />
      )}

      {isUploadOpen && <ExcelUploadModal onClose={() => setUploadOpen(false)} />}
    </>
  );
}

function FolderTree({
  selectedFolderId,
  counts,
  onSelect,
}: {
  selectedFolderId: string;
  counts: Record<string, number>;
  onSelect: (folderId: string) => void;
}) {
  return (
    <aside className="bg-[var(--bg-subtle)] p-3">
      <div className="mb-3 flex items-center justify-between px-2">
        <h2 className="text-sm font-semibold">폴더</h2>
        <button className="text-xs font-medium text-[var(--brand-primary)]">
          폴더 추가
        </button>
      </div>
      <nav className="space-y-1">
        {folders.map((folder) => (
          <button
            key={folder.id}
            onClick={() => onSelect(folder.id)}
            className={cn(
              "flex h-9 w-full items-center justify-between rounded-md px-2 text-sm transition-colors",
              folder.parentId && "pl-7",
              selectedFolderId === folder.id
                ? "bg-white text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-secondary)] hover:bg-white",
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Folder className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
              <span className="truncate">{folder.label}</span>
            </span>
            <span className="text-xs text-[var(--text-tertiary)]">
              {counts[folder.id] ?? 0}
            </span>
          </button>
        ))}
      </nav>
    </aside>
  );
}

function TestCaseTable({
  testCases,
  selectedIds,
  allSelected,
  onToggleAll,
  onToggle,
  onOpen,
}: {
  testCases: TestCase[];
  selectedIds: string[];
  allSelected: boolean;
  onToggleAll: () => void;
  onToggle: (id: string) => void;
  onOpen: (tc: TestCase) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] border-collapse text-sm">
        <thead className="bg-[var(--bg-subtle)] text-left text-[var(--text-secondary)]">
          <tr>
            <th className="w-10 px-4 py-3">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleAll}
                aria-label="전체 선택"
              />
            </th>
            <th className="w-24 px-4 py-3 font-medium">ID</th>
            <th className="px-4 py-3 font-medium">제목</th>
            <th className="w-28 px-4 py-3 font-medium">우선순위</th>
            <th className="w-28 px-4 py-3 font-medium">상태</th>
            <th className="w-56 px-4 py-3 font-medium">태그</th>
            <th className="w-28 px-4 py-3 font-medium">작성자</th>
            <th className="w-28 px-4 py-3 font-medium">최근 수정</th>
            <th className="w-14 px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {testCases.map((tc) => (
            <tr
              key={tc.id}
              onClick={() => onOpen(tc)}
              className="cursor-pointer border-t border-[var(--border-default)] hover:bg-[var(--bg-subtle)]"
            >
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(tc.id)}
                  onClick={(event) => event.stopPropagation()}
                  onChange={() => onToggle(tc.id)}
                  aria-label={`${tc.id} 선택`}
                />
              </td>
              <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">
                {tc.id}
              </td>
              <td className="px-4 py-3 font-medium">{tc.title}</td>
              <td className="px-4 py-3">
                <PriorityBadge
                  priority={tc.priority}
                  label={priorityLabels[tc.priority]}
                />
              </td>
              <td className="px-4 py-3 text-[var(--text-secondary)]">
                {statusLabels[tc.status]}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {tc.tags.map((tag) => (
                    <span
                      key={`${tc.id}-${tag}`}
                      className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-xs text-[var(--text-secondary)]"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3 text-[var(--text-secondary)]">
                {tc.author}
              </td>
              <td className="px-4 py-3 text-[var(--text-secondary)]">
                {tc.updatedAtLabel}
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpen(tc);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-tertiary)] hover:bg-[var(--bg-muted)]"
                  aria-label={`${tc.id} 더보기`}
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TestCaseDrawer({
  draft,
  submitted,
  onChange,
  onClose,
  onSave,
}: {
  draft: Draft;
  submitted: boolean;
  onChange: (draft: Draft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const titleError = submitted && draft.title.trim().length === 0;

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    onChange({ ...draft, [key]: value });
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/20">
      <aside className="ml-auto flex h-full w-full max-w-[640px] flex-col border-l border-[var(--border-default)] bg-white shadow-xl">
        <header className="flex h-14 items-center justify-between border-b border-[var(--border-default)] px-5">
          <div>
            <p className="text-xs text-[var(--text-tertiary)]">
              {draft.id ?? "새 테스트케이스"}
            </p>
            <h2 className="text-base font-semibold">
              {draft.id ? "TC 상세/편집" : "새 테스트케이스"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-tertiary)] hover:bg-[var(--bg-muted)]"
            aria-label="Drawer 닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <label className="block text-sm font-medium">
            제목 <span className="text-[var(--status-fail)]">*</span>
            <input
              value={draft.title}
              onChange={(event) => update("title", event.target.value)}
              className={cn(
                "mt-2 h-10 w-full rounded-md border px-3 text-sm outline-none focus:border-[var(--brand-primary)]",
                titleError
                  ? "border-[var(--status-fail)]"
                  : "border-[var(--border-default)]",
              )}
              placeholder="테스트케이스 제목"
            />
            {titleError && (
              <span className="mt-1 block text-xs text-[var(--status-fail)]">
                제목을 입력하세요.
              </span>
            )}
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm font-medium">
              우선순위
              <select
                value={draft.priority}
                onChange={(event) =>
                  update("priority", event.target.value as Priority)
                }
                className="mt-2 h-10 w-full rounded-md border border-[var(--border-default)] bg-white px-3 text-sm outline-none focus:border-[var(--brand-primary)]"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label className="block text-sm font-medium">
              폴더
              <select
                value={draft.folderId}
                onChange={(event) => update("folderId", event.target.value)}
                className="mt-2 h-10 w-full rounded-md border border-[var(--border-default)] bg-white px-3 text-sm outline-none focus:border-[var(--brand-primary)]"
              >
                {folders
                  .filter((folder) => folder.id !== "all")
                  .map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.parentId ? "ㄴ " : ""}
                      {folder.label}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <label className="block text-sm font-medium">
            태그
            <div className="relative mt-2">
              <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input
                value={draft.tagsText}
                onChange={(event) => update("tagsText", event.target.value)}
                className="h-10 w-full rounded-md border border-[var(--border-default)] pl-9 pr-3 text-sm outline-none focus:border-[var(--brand-primary)]"
                placeholder="smoke, payment"
              />
            </div>
          </label>

          <TextareaField
            label="설명"
            value={draft.description}
            onChange={(value) => update("description", value)}
            rows={3}
          />
          <TextareaField
            label="사전 조건"
            value={draft.preconditions}
            onChange={(value) => update("preconditions", value)}
            rows={4}
          />
          <TextareaField
            label="실행 단계"
            value={draft.stepsText}
            onChange={(value) => update("stepsText", value)}
            rows={5}
            placeholder="1. 결제 페이지 진입&#10;2. 카드 정보 입력"
          />
          <TextareaField
            label="기대 결과"
            value={draft.expectedResult}
            onChange={(value) => update("expectedResult", value)}
            rows={4}
          />

          <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)] p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Paperclip className="h-4 w-4" />
              첨부 파일
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              첨부 파일 업로드는 후속 단계에서 구현합니다.
            </p>
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t border-[var(--border-default)] px-5 py-4">
          <button
            onClick={onClose}
            className="h-9 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
          >
            취소
          </button>
          <button
            onClick={onSave}
            className="h-9 rounded-md bg-[var(--brand-primary)] px-3 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)]"
          >
            저장
          </button>
        </footer>
      </aside>
    </div>
  );
}

function ExcelUploadModal({ onClose }: { onClose: () => void }) {
  const [hasMockFile, setHasMockFile] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4">
      <div className="w-full max-w-xl rounded-lg border border-[var(--border-default)] bg-white shadow-xl">
        <header className="flex h-14 items-center justify-between border-b border-[var(--border-default)] px-5">
          <h2 className="text-base font-semibold">엑셀 파일 업로드</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-tertiary)] hover:bg-[var(--bg-muted)]"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-5 px-5 py-5">
          <button className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]">
            <Download className="h-4 w-4" />
            엑셀 템플릿 다운로드
          </button>
          <p className="text-sm text-[var(--text-secondary)]">
            먼저 표준 템플릿을 다운로드하세요. 실제 파일 파싱은 후속 단계에서
            연결합니다.
          </p>

          <div className="rounded-lg border-2 border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)] px-6 py-10 text-center">
            <Upload className="mx-auto h-8 w-8 text-[var(--text-tertiary)]" />
            <p className="mt-3 text-sm font-medium">
              파일을 끌어다 놓거나 선택하세요
            </p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              지원 예정: .xlsx, .xls, .csv
            </p>
            <button
              onClick={() => setHasMockFile(true)}
              className="mt-4 h-9 rounded-md bg-[var(--brand-primary)] px-3 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)]"
            >
              파일 선택
            </button>
          </div>

          <section className="rounded-lg border border-[var(--border-default)] p-4">
            <h3 className="mb-3 text-sm font-semibold">업로드 후 미리보기</h3>
            <div className="space-y-2 text-sm">
              <PreviewItem
                ok={hasMockFile}
                text={hasMockFile ? "인식된 행: 45개" : "파일 선택 대기 중"}
              />
              <PreviewItem ok={hasMockFile} text="컬럼 매핑 확인" />
              <PreviewItem ok={!hasMockFile} warning text="2개 행에 누락된 필드" />
            </div>
          </section>
        </div>

        <footer className="flex justify-end gap-2 border-t border-[var(--border-default)] px-5 py-4">
          <button
            onClick={onClose}
            className="h-9 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
          >
            취소
          </button>
          <button
            disabled={!hasMockFile}
            className="h-9 rounded-md bg-[var(--brand-primary)] px-3 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--status-pending)]"
          >
            업로드 실행
          </button>
        </footer>
      </div>
    </div>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  rows,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="mt-2 w-full resize-none rounded-md border border-[var(--border-default)] px-3 py-2 text-sm outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-primary)]"
        placeholder={placeholder}
      />
    </label>
  );
}

function BulkButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="h-8 rounded-md border border-blue-200 bg-white px-3 text-sm font-medium text-[var(--brand-primary)] hover:bg-blue-50"
    >
      {children}
    </button>
  );
}

function PreviewItem({
  ok,
  warning,
  text,
}: {
  ok: boolean;
  warning?: boolean;
  text: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2",
        warning ? "text-amber-700" : "text-[var(--text-secondary)]",
        ok && !warning && "text-emerald-700",
      )}
    >
      <CheckCircle2 className="h-4 w-4" />
      {text}
    </div>
  );
}

function isInFolder(testCaseFolderId: string, selectedFolderId: string) {
  if (testCaseFolderId === selectedFolderId) {
    return true;
  }

  return folders.some(
    (folder) =>
      folder.id === testCaseFolderId && folder.parentId === selectedFolderId,
  );
}
