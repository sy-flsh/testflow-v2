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
  Sparkles,
  Tag,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { DialogShell } from "@/components/common/dialog-shell";
import { DrawerShell } from "@/components/common/drawer-shell";
import { FormField, SelectField, TextAreaField, TextInput } from "@/components/common/form-field";
import { TableActionBar } from "@/components/common/action-bar";
import { PriorityBadge } from "@/components/common/priority-badge";
import { getPermissionMessage, useCurrentAuth } from "@/features/auth/use-current-auth";
import type { Priority, TestCase, TestCaseStatus as TcStatus, TestFolder } from "@/lib/domain/types";
import {
  priorityLabels,
  testCaseStatusLabels as statusLabels,
} from "@/lib/domain/labels";
import { mockTestFolders } from "@/lib/mock/mock-data";
import {
  loadMockTestCases,
  loadTestCaseBackupSnapshot,
  saveTestCaseBackupSnapshot,
} from "@/lib/mock/mock-store";
import { cn } from "@/lib/utils";
import type { TestCaseImportPreview, TestCaseImportPreviewRow } from "@/lib/testcases/import-api";
import type {
  AiDraftDto,
  AiDraftInput,
  AiDraftItem,
  AiDraftTestType,
} from "@/lib/testcases/ai-draft-types";

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

const allFolder: TestFolder = { id: "all", label: "전체" };

export function TestCaseManager({ projectId }: { projectId: string }) {
  const { permissions, isLoading: isAuthLoading } = useCurrentAuth();
  const [isMounted, setIsMounted] = useState(false);
  const [folders, setFolders] = useState<TestFolder[]>([allFolder]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackupMode, setIsBackupMode] = useState(false);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState("all");
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<TcStatus | "all">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drawerDraft, setDrawerDraft] = useState<Draft | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isUploadOpen, setUploadOpen] = useState(false);
  const [isAiOpen, setAiOpen] = useState(false);
  const canCreate = permissions?.canCreate === true;
  const canUpdate = permissions?.canUpdate === true;
  const canDelete = permissions?.canDelete === true;
  const canBulkAction = canUpdate || canDelete;
  const permissionMessage = getPermissionMessage(isAuthLoading);

  const apiBase = `/api/projects/${encodeURIComponent(projectId)}`;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const reloadFromApi = useCallback(
    async (options?: { fallback?: boolean }) => {
      setIsLoading(true);
      setActionError("");
      setNotice("");

      try {
        const [apiFolders, apiTestCases] = await Promise.all([
          requestData<TestFolder[]>(`${apiBase}/test-folders`),
          requestData<TestCase[]>(`${apiBase}/test-cases`),
        ]);

        const nextFolders = withAllFolder(apiFolders);
        setFolders(nextFolders);
        setTestCases(apiTestCases);
        saveTestCaseBackupSnapshot(projectId, nextFolders, apiTestCases);
        setIsBackupMode(false);
      } catch {
        if (options?.fallback === false) {
          throw new Error("테스트케이스 목록을 다시 불러오지 못했습니다.");
        }

        const snapshot = loadTestCaseBackupSnapshot(projectId);

        if (snapshot) {
          setFolders(withAllFolder(snapshot.folders));
          setTestCases(snapshot.testCases);
          setNotice(
            `백업 데이터 표시 중입니다. 마지막 백업: ${formatBackupTime(snapshot.savedAt)}`,
          );
        } else {
          setFolders(mockTestFolders);
          setTestCases(loadMockTestCases());
          setNotice("API 연결에 실패해 기존 mock fallback 데이터를 표시 중입니다.");
        }

        setIsBackupMode(true);
      } finally {
        setIsLoading(false);
      }
    },
    [apiBase, projectId],
  );

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        await reloadFromApi();
      } catch {
        if (active) {
          setNotice("테스트케이스 데이터를 불러오지 못했습니다.");
        }
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, [reloadFromApi]);

  const allTags = useMemo(
    () => Array.from(new Set(testCases.flatMap((tc) => tc.tags))).sort(),
    [testCases],
  );

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = { all: testCases.length };

    for (const folder of folders) {
      if (folder.id !== "all") {
        counts[folder.id] = testCases.filter((tc) =>
          isInFolder(tc.folderId, folder.id, folders),
        ).length;
      }
    }

    return counts;
  }, [folders, testCases]);

  const visibleTestCases = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return testCases.filter((tc) => {
      const matchesFolder =
        selectedFolderId === "all" || isInFolder(tc.folderId, selectedFolderId, folders);
      const matchesQuery =
        !normalizedQuery ||
        tc.id.toLowerCase().includes(normalizedQuery) ||
        tc.title.toLowerCase().includes(normalizedQuery);
      const matchesTag = tagFilter === "all" || tc.tags.includes(tagFilter);
      const matchesStatus =
        statusFilter === "all" || tc.status === statusFilter;

      return matchesFolder && matchesQuery && matchesTag && matchesStatus;
    });
  }, [folders, query, selectedFolderId, statusFilter, tagFilter, testCases]);

  const allVisibleSelected =
    visibleTestCases.length > 0 &&
    visibleTestCases.every((tc) => selectedIds.includes(tc.id));

  if (!isMounted) {
    return (
      <div className="rounded-lg border border-[var(--border-default)] bg-white px-4 py-3 text-sm text-[var(--text-secondary)]">
        테스트케이스 데이터를 불러오는 중입니다.
      </div>
    );
  }

  function openNewDrawer() {
    if (!canCreate) {
      setActionError(permissionMessage);
      return;
    }

    setSubmitted(false);
    setActionError("");
    setDrawerDraft({
      title: "",
      priority: "medium",
      folderId: selectedFolderId === "all" ? getDefaultFolderId(folders) : selectedFolderId,
      tagsText: "",
      description: "",
      preconditions: "",
      stepsText: "",
      expectedResult: "",
    });
  }

  function openEditDrawer(tc: TestCase) {
    setSubmitted(false);
    setActionError("");
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

  async function saveDrawerDraft() {
    if (!drawerDraft) {
      return;
    }

    const canSave = drawerDraft.id ? canUpdate : canCreate;
    if (!canSave) {
      setActionError(permissionMessage);
      return;
    }

    setSubmitted(true);

    if (!drawerDraft.title.trim()) {
      return;
    }

    const payload = {
      title: drawerDraft.title.trim(),
      priority: drawerDraft.priority,
      folderId: drawerDraft.folderId,
      tags: drawerDraft.tagsText
        .split(",")
        .map((tag) => tag.trim().replace(/^#/, ""))
        .filter(Boolean),
      description: drawerDraft.description,
      preconditions: drawerDraft.preconditions,
      steps: drawerDraft.stepsText
        .split("\n")
        .map((step) => step.trim())
        .filter(Boolean),
      expectedResult: drawerDraft.expectedResult,
    };

    setActionError("");

    try {
      if (drawerDraft.id) {
        const updatedTestCase = await requestData<TestCase>(
          `${apiBase}/test-cases/${encodeURIComponent(drawerDraft.id)}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
        );
        const nextTestCases = testCases.map((tc) =>
          tc.id === updatedTestCase.id ? updatedTestCase : tc,
        );
        setTestCases(nextTestCases);
        saveTestCaseBackupSnapshot(projectId, folders, nextTestCases);
      } else {
        const createdTestCase = await requestData<TestCase>(`${apiBase}/test-cases`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        const nextTestCases = [createdTestCase, ...testCases];
        setTestCases(nextTestCases);
        saveTestCaseBackupSnapshot(projectId, folders, nextTestCases);
      }

      setDrawerDraft(null);
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
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

  async function deleteSelected() {
    if (!canDelete) {
      setActionError(permissionMessage);
      return;
    }

    setActionError("");

    try {
      await Promise.all(
        selectedIds.map((id) =>
          requestData<{ id: string }>(`${apiBase}/test-cases/${encodeURIComponent(id)}`, {
            method: "DELETE",
          }),
        ),
      );
      const nextTestCases = testCases.filter((tc) => !selectedIds.includes(tc.id));
      setTestCases(nextTestCases);
      saveTestCaseBackupSnapshot(projectId, folders, nextTestCases);
      setSelectedIds([]);
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  }

  async function addTagToSelected() {
    if (!canUpdate) {
      setActionError(permissionMessage);
      return;
    }

    setActionError("");

    try {
      const updatedTestCases = await requestData<TestCase[]>(`${apiBase}/test-cases/bulk`, {
        method: "PATCH",
        body: JSON.stringify({
          ids: selectedIds,
          tags: ["bulk"],
          tagsAction: "append",
        }),
      });
      const nextTestCases = mergeUpdatedTestCases(testCases, updatedTestCases);
      setTestCases(nextTestCases);
      saveTestCaseBackupSnapshot(projectId, folders, nextTestCases);
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  }

  async function moveSelectedFolder() {
    if (!canUpdate) {
      setActionError(permissionMessage);
      return;
    }

    setActionError("");

    try {
      const updatedTestCases = await requestData<TestCase[]>(`${apiBase}/test-cases/bulk`, {
        method: "PATCH",
        body: JSON.stringify({
          ids: selectedIds,
          folderId: "payment-checkout",
        }),
      });
      const nextTestCases = mergeUpdatedTestCases(testCases, updatedTestCases);
      setTestCases(nextTestCases);
      saveTestCaseBackupSnapshot(projectId, folders, nextTestCases);
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
            ? "테스트케이스 데이터를 불러오는 중입니다."
            : actionError || notice}
        </div>
      )}

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
              onClick={() => {
                if (!canCreate) {
                  setActionError(permissionMessage);
                  return;
                }
                setAiOpen(true);
              }}
              disabled={!canCreate}
              title={!canCreate ? permissionMessage : undefined}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-violet-200 bg-violet-50 px-3 text-sm font-medium text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              AI 초안 생성
            </button>
            <button
              onClick={() => {
                if (!canCreate) {
                  setActionError(permissionMessage);
                  return;
                }
                setUploadOpen(true);
              }}
              disabled={!canCreate}
              title={!canCreate ? permissionMessage : undefined}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--brand-primary)] bg-blue-50 px-3 text-sm font-medium text-[var(--brand-primary)] hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              엑셀 업로드
            </button>
            <button
              onClick={() => {
                window.location.href = `${apiBase}/test-cases/template.xlsx`;
              }}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
            >
              <Download className="h-4 w-4" />
              다운로드
            </button>
            <button
              onClick={openNewDrawer}
              disabled={!canCreate}
              title={!canCreate ? permissionMessage : undefined}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--brand-primary)] px-3 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              <Plus className="h-4 w-4" />새 테스트케이스
            </button>
          </div>
        </div>
      </div>

      <div className="grid min-h-[560px] grid-cols-1 overflow-hidden rounded-lg border border-[var(--border-default)] bg-white lg:grid-cols-[240px_minmax(0,1fr)]">
        <FolderTree
          folders={folders}
          selectedFolderId={selectedFolderId}
          counts={folderCounts}
          onSelect={(folderId) => {
            setSelectedFolderId(folderId);
            setSelectedIds([]);
          }}
        />

        <section className="min-w-0 border-t border-[var(--border-default)] lg:border-l lg:border-t-0">
          {selectedIds.length > 0 && (
            <TableActionBar count={selectedIds.length} className="rounded-none border-x-0 border-t-0">
              <BulkButton onClick={deleteSelected} disabled={!canDelete} title={!canDelete ? permissionMessage : undefined}>삭제</BulkButton>
              <BulkButton onClick={addTagToSelected} disabled={!canUpdate} title={!canUpdate ? permissionMessage : undefined}>태그 추가</BulkButton>
              <BulkButton onClick={moveSelectedFolder} disabled={!canUpdate} title={!canUpdate ? permissionMessage : undefined}>폴더 이동</BulkButton>
            </TableActionBar>
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
              canSelect={canBulkAction}
              permissionMessage={permissionMessage}
            />
          )}
        </section>
      </div>

      {drawerDraft && (
        <TestCaseDrawer
          folders={folders}
          draft={drawerDraft}
          submitted={submitted}
          submitError={actionError}
          onChange={setDrawerDraft}
          onClose={() => setDrawerDraft(null)}
          onSave={saveDrawerDraft}
          canSave={drawerDraft.id ? canUpdate : canCreate}
          permissionMessage={permissionMessage}
        />
      )}

      {isUploadOpen && (
        <ExcelUploadModal
          apiBase={apiBase}
          onClose={() => setUploadOpen(false)}
          onImported={async () => {
            await reloadFromApi({ fallback: false });
          }}
        />
      )}

      {isAiOpen && (
        <AiDraftModal
          apiBase={apiBase}
          folders={folders}
          selectedFolderId={selectedFolderId}
          onClose={() => setAiOpen(false)}
          onImported={async () => {
            await reloadFromApi({ fallback: false });
          }}
        />
      )}
    </>
  );
}

function FolderTree({
  folders,
  selectedFolderId,
  counts,
  onSelect,
}: {
  folders: TestFolder[];
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
  canSelect,
  permissionMessage,
}: {
  testCases: TestCase[];
  selectedIds: string[];
  allSelected: boolean;
  onToggleAll: () => void;
  onToggle: (id: string) => void;
  onOpen: (tc: TestCase) => void;
  canSelect: boolean;
  permissionMessage: string;
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
                disabled={!canSelect}
                title={!canSelect ? permissionMessage : undefined}
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
                  disabled={!canSelect}
                  title={!canSelect ? permissionMessage : undefined}
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
  folders,
  draft,
  submitted,
  submitError,
  onChange,
  onClose,
  onSave,
  canSave,
  permissionMessage,
}: {
  folders: TestFolder[];
  draft: Draft;
  submitted: boolean;
  submitError?: string;
  onChange: (draft: Draft) => void;
  onClose: () => void;
  onSave: () => void;
  canSave: boolean;
  permissionMessage: string;
}) {
  const titleError = submitted && draft.title.trim().length === 0;

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    onChange({ ...draft, [key]: value });
  }

  return (
    <DrawerShell
      title={draft.id ? "TC 상세/편집" : "새 테스트케이스"}
      description={draft.id ?? "새 테스트케이스"}
      onClose={onClose}
      widthClassName="max-w-[640px]"
      footer={
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="h-9 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
          >
            취소
          </button>
          <button
            onClick={onSave}
            disabled={!canSave}
            title={!canSave ? permissionMessage : undefined}
            className="h-9 rounded-md bg-[var(--brand-primary)] px-3 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            저장
          </button>
        </div>
      }
    >
      <div className="space-y-5 px-5 py-5">
        <FormField label="제목" required error={titleError ? "제목을 입력하세요." : undefined}>
          <TextInput
            value={draft.title}
            onChange={(event) => update("title", event.target.value)}
            placeholder="테스트케이스 제목"
            disabled={!canSave}
          />
        </FormField>

        <div className="grid gap-3 md:grid-cols-2">
          <FormField label="우선순위">
            <SelectField
              value={draft.priority}
              onChange={(event) => update("priority", event.target.value as Priority)}
              disabled={!canSave}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </SelectField>
          </FormField>
          <FormField label="폴더">
            <SelectField
              value={draft.folderId}
              onChange={(event) => update("folderId", event.target.value)}
              disabled={!canSave}
            >
              {folders
                .filter((folder) => folder.id !== "all")
                .map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.parentId ? "ㄴ " : ""}
                    {folder.label}
                  </option>
                ))}
            </SelectField>
          </FormField>
        </div>

        <FormField label="태그">
          <div className="relative">
            <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <TextInput
              value={draft.tagsText}
              onChange={(event) => update("tagsText", event.target.value)}
              placeholder="smoke, payment"
              className="pl-9"
              disabled={!canSave}
            />
          </div>
        </FormField>

        <FormField label="설명">
          <TextAreaField
            value={draft.description}
            onChange={(event) => update("description", event.target.value)}
            rows={3}
            disabled={!canSave}
          />
        </FormField>
        <FormField label="사전 조건">
          <TextAreaField
            value={draft.preconditions}
            onChange={(event) => update("preconditions", event.target.value)}
            rows={4}
            disabled={!canSave}
          />
        </FormField>
        <FormField label="실행 단계">
          <TextAreaField
            value={draft.stepsText}
            onChange={(event) => update("stepsText", event.target.value)}
            rows={5}
            placeholder="1. 결제 페이지 진입&#10;2. 카드 정보 입력"
            disabled={!canSave}
          />
        </FormField>
        <FormField label="기대 결과">
          <TextAreaField
            value={draft.expectedResult}
            onChange={(event) => update("expectedResult", event.target.value)}
            rows={4}
            disabled={!canSave}
          />
        </FormField>

        <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)] p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Paperclip className="h-4 w-4" />
            첨부 파일
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            첨부 파일 업로드는 후속 단계에서 구현합니다.
          </p>
        </div>

        {submitError && (
          <div className="rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger-text)]">
            {submitError}
          </div>
        )}
      </div>
    </DrawerShell>
  );
}

function ExcelUploadModal({
  apiBase,
  onClose,
  onImported,
}: {
  apiBase: string;
  onClose: () => void;
  onImported: () => Promise<void>;
}) {
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<TestCaseImportPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const validRows = preview?.rows.filter((row) => row.status === "valid") ?? [];

  async function previewFile(file: File) {
    setFileName(file.name);
    setPreview(null);
    setSuccessMessage("");
    setError("");

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("현재 실제 가져오기는 CSV 파일만 지원합니다. XLSX는 템플릿 다운로드용입니다.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setIsPreviewing(true);

    try {
      const nextPreview = await requestData<TestCaseImportPreview>(
        `${apiBase}/test-cases/import/preview`,
        {
          method: "POST",
          body: formData,
          headers: {},
        },
      );
      setPreview(nextPreview);
    } catch (previewError) {
      setError(getErrorMessage(previewError));
    } finally {
      setIsPreviewing(false);
    }
  }

  async function commitImport() {
    if (!preview || validRows.length === 0) {
      return;
    }

    setIsCommitting(true);
    setError("");
    setSuccessMessage("");

    try {
      const result = await requestData<{
        createdCount: number;
        skippedCount: number;
        errors: string[];
      }>(`${apiBase}/test-cases/import/commit`, {
        method: "POST",
        body: JSON.stringify({
          rows: validRows,
        }),
      });
      await onImported();
      setSuccessMessage(
        `${result.createdCount}개 테스트케이스를 가져왔습니다.${
          result.skippedCount > 0 ? ` ${result.skippedCount}개는 건너뛰었습니다.` : ""
        }`,
      );
      if (result.errors.length > 0) {
        setError(result.errors.join("\n"));
      }
    } catch (commitError) {
      setError(getErrorMessage(commitError));
    } finally {
      setIsCommitting(false);
    }
  }

  return (
    <DialogShell
      title="엑셀 파일 업로드"
      description="XLSX 템플릿을 내려받아 작성한 뒤 CSV로 저장해 가져올 수 있습니다."
      onClose={onClose}
      maxWidth="max-w-3xl"
      footer={
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="h-9 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
          >
            취소
          </button>
          <button
            onClick={commitImport}
            disabled={validRows.length === 0 || isCommitting}
            className="h-9 rounded-md bg-[var(--brand-primary)] px-3 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--status-pending)]"
          >
            {isCommitting ? "가져오는 중..." : "유효 행만 가져오기"}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <a
          href={`${apiBase}/test-cases/template.xlsx`}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
        >
          <Download className="h-4 w-4" />
          엑셀 템플릿 다운로드
        </a>
        <div className="rounded-lg border-2 border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)] px-6 py-10 text-center">
          <Upload className="mx-auto h-8 w-8 text-[var(--text-tertiary)]" />
          <p className="mt-3 text-sm font-medium">파일을 끌어다 놓거나 선택하세요</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            현재 가져오기는 .csv를 지원합니다. 템플릿은 XLSX로 제공됩니다.
          </p>
          <label className="mt-4 inline-flex h-9 cursor-pointer items-center rounded-md bg-[var(--brand-primary)] px-3 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)]">
            {isPreviewing ? "미리보기 생성 중..." : "CSV 파일 선택"}
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={isPreviewing || isCommitting}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void previewFile(file);
                }
                event.currentTarget.value = "";
              }}
              className="hidden"
            />
          </label>
          {fileName && (
            <p className="mt-3 text-xs font-medium text-[var(--text-secondary)]">
              선택한 파일: {fileName}
            </p>
          )}
        </div>

        <section className="rounded-lg border border-[var(--border-default)] p-4">
          <h3 className="mb-3 text-sm font-semibold">업로드 후 미리보기</h3>
          <div className="space-y-2 text-sm">
            <PreviewItem
              ok={Boolean(preview)}
              text={preview ? `인식된 행: ${preview.totalRows}개` : "파일 선택 대기 중"}
            />
            <PreviewItem
              ok={Boolean(preview)}
              text={preview ? `유효 행: ${preview.validRows}개` : "컬럼 매핑 확인"}
            />
            <PreviewItem
              ok={preview?.errorRows === 0}
              warning={Boolean(preview && preview.errorRows > 0)}
              text={
                preview
                  ? `오류 행: ${preview.errorRows}개`
                  : "title, priority, status 필수값을 검사합니다"
              }
            />
          </div>
          {preview && <ImportPreviewTable rows={preview.rows} />}
        </section>

        {successMessage && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {successMessage}
          </div>
        )}
        {error && (
          <div className="whitespace-pre-wrap rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger-text)]">
            {error}
          </div>
        )}
      </div>
    </DialogShell>
  );
}

function ImportPreviewTable({ rows }: { rows: TestCaseImportPreviewRow[] }) {
  return (
    <div className="mt-4 max-h-72 overflow-auto rounded-md border border-[var(--border-default)]">
      <table className="w-full min-w-[760px] text-left text-xs">
        <thead className="sticky top-0 bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
          <tr>
            <th className="px-3 py-2 font-medium">행</th>
            <th className="px-3 py-2 font-medium">상태</th>
            <th className="px-3 py-2 font-medium">폴더</th>
            <th className="px-3 py-2 font-medium">제목</th>
            <th className="px-3 py-2 font-medium">우선순위</th>
            <th className="px-3 py-2 font-medium">검증 메시지</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-default)]">
          {rows.map((row) => (
            <tr key={`preview-${row.rowNumber}`} className="bg-white">
              <td className="px-3 py-2 text-[var(--text-tertiary)]">{row.rowNumber}</td>
              <td className="px-3 py-2">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-medium",
                    row.status === "valid"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-700",
                  )}
                >
                  {row.status === "valid" ? "유효" : "오류"}
                </span>
              </td>
              <td className="px-3 py-2 text-[var(--text-secondary)]">
                {row.mapped.folder || "기본 폴더"}
              </td>
              <td className="max-w-[240px] truncate px-3 py-2 font-medium">
                {row.mapped.title || "-"}
              </td>
              <td className="px-3 py-2 text-[var(--text-secondary)]">{row.mapped.priority}</td>
              <td className="px-3 py-2 text-[var(--text-secondary)]">
                {[...row.errors, ...row.warnings].length > 0
                  ? [...row.errors, ...row.warnings].join(" / ")
                  : "문제 없음"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AiDraftModal({
  apiBase,
  folders,
  selectedFolderId,
  onClose,
  onImported,
}: {
  apiBase: string;
  folders: TestFolder[];
  selectedFolderId: string;
  onClose: () => void;
  onImported: () => Promise<void>;
}) {
  const defaultFolderId =
    selectedFolderId === "all" ? getDefaultFolderId(folders) : selectedFolderId;
  const [featureName, setFeatureName] = useState("");
  const [requirementText, setRequirementText] = useState("");
  const [targetFolderId, setTargetFolderId] = useState(defaultFolderId);
  const [priority, setPriority] = useState<Priority>("medium");
  const [scenarioCount, setScenarioCount] = useState("4");
  const [testType, setTestType] = useState<AiDraftTestType>("normal");
  const [draft, setDraft] = useState<AiDraftDto | null>(null);
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function generateDraft() {
    setError("");
    setNotice("");

    if (!requirementText.trim()) {
      setError("요구사항을 입력하세요.");
      return;
    }

    setIsGenerating(true);

    try {
      const payload = await requestData<{
        draft: AiDraftDto;
        fallbackUsed: boolean;
        message: string;
      }>(`${apiBase}/test-cases/ai-drafts`, {
        method: "POST",
        body: JSON.stringify({
          featureName,
          requirementText,
          targetFolderId,
          priority,
          scenarioCount: Number(scenarioCount),
          testType,
        } satisfies AiDraftInput),
      });
      setDraft(payload.draft);
      setSelectedIndexes(payload.draft.items.map((_item, index) => index));
      setNotice(payload.message);
    } catch (generateError) {
      setError(getErrorMessage(generateError));
    } finally {
      setIsGenerating(false);
    }
  }

  async function saveSelectedDrafts() {
    if (!draft || selectedIndexes.length === 0) {
      return;
    }

    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const result = await requestData<{ savedCount: number }>(
        `${apiBase}/test-cases/ai-drafts/${encodeURIComponent(draft.id)}/save`,
        {
          method: "POST",
          body: JSON.stringify({
            itemIndexes: selectedIndexes,
            targetFolderId,
          }),
        },
      );
      await onImported();
      setNotice(`${result.savedCount}개 AI 초안을 테스트케이스로 저장했습니다.`);
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  function toggleIndex(index: number) {
    setSelectedIndexes((current) =>
      current.includes(index)
        ? current.filter((item) => item !== index)
        : [...current, index].sort((a, b) => a - b),
    );
  }

  return (
    <DialogShell
      title="AI 테스트케이스 초안 생성"
      description="요구사항을 입력하면 저장 전 검토 가능한 테스트케이스 초안을 생성합니다."
      onClose={onClose}
      maxWidth="max-w-5xl"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button
            onClick={onClose}
            className="h-9 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
          >
            닫기
          </button>
          <button
            onClick={generateDraft}
            disabled={isGenerating}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-violet-200 bg-violet-50 px-3 text-sm font-medium text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            {isGenerating ? "생성 중..." : "초안 생성"}
          </button>
          <button
            onClick={saveSelectedDrafts}
            disabled={!draft || selectedIndexes.length === 0 || isSaving}
            className="h-9 rounded-md bg-[var(--brand-primary)] px-3 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--status-pending)]"
          >
            {isSaving ? "저장 중..." : `선택 초안 저장 ${selectedIndexes.length || ""}`}
          </button>
        </div>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-4">
          <FormField label="기능명">
            <TextInput
              value={featureName}
              onChange={(event) => setFeatureName(event.target.value)}
              placeholder="예: 쿠폰 적용 결제"
            />
          </FormField>
          <FormField label="요구사항" required>
            <TextAreaField
              value={requirementText}
              onChange={(event) => setRequirementText(event.target.value)}
              rows={8}
              placeholder="기능 요구사항, 예외 조건, 검증하고 싶은 사용자 흐름을 입력하세요."
            />
          </FormField>
          <div className="grid gap-3 md:grid-cols-2">
            <FormField label="저장 폴더">
              <SelectField value={targetFolderId} onChange={(event) => setTargetFolderId(event.target.value)}>
                {folders
                  .filter((folder) => folder.id !== "all")
                  .map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.parentId ? "ㄴ " : ""}
                      {folder.label}
                    </option>
                  ))}
              </SelectField>
            </FormField>
            <FormField label="기본 우선순위">
              <SelectField value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </SelectField>
            </FormField>
            <FormField label="생성 개수">
              <SelectField value={scenarioCount} onChange={(event) => setScenarioCount(event.target.value)}>
                <option value="3">3개</option>
                <option value="4">4개</option>
                <option value="5">5개</option>
              </SelectField>
            </FormField>
            <FormField label="테스트 유형">
              <SelectField value={testType} onChange={(event) => setTestType(event.target.value as AiDraftTestType)}>
                <option value="normal">Normal</option>
                <option value="edge">Edge</option>
                <option value="negative">Negative</option>
                <option value="regression">Regression</option>
              </SelectField>
            </FormField>
          </div>
        </section>

        <section className="min-h-[420px] rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">생성 결과 Preview</h3>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                선택한 초안만 DB 테스트케이스로 저장됩니다.
              </p>
            </div>
            {draft && (
              <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-[var(--text-secondary)]">
                {draft.status === "fallback" ? "Fallback" : "AI"}
              </span>
            )}
          </div>

          {!draft ? (
            <EmptyState
              icon={Sparkles}
              title="아직 생성된 초안이 없습니다"
              description="요구사항을 입력한 뒤 초안 생성을 실행하세요."
            />
          ) : (
            <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
              {draft.items.map((item, index) => (
                <AiDraftPreviewCard
                  key={`${draft.id}-${index}-${item.title}`}
                  index={index}
                  item={item}
                  checked={selectedIndexes.includes(index)}
                  onToggle={() => toggleIndex(index)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {notice && (
        <div
          className={cn(
            "mt-4 rounded-md border px-3 py-2 text-sm",
            draft?.status === "fallback"
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-700",
          )}
        >
          {notice}
        </div>
      )}
      {error && (
        <div className="mt-4 whitespace-pre-wrap rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger-text)]">
          {error}
        </div>
      )}
    </DialogShell>
  );
}

function AiDraftPreviewCard({
  index,
  item,
  checked,
  onToggle,
}: {
  index: number;
  item: AiDraftItem;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <article className="rounded-lg border border-[var(--border-default)] bg-white p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="mt-1 h-4 w-4 rounded border-[var(--border-default)]"
        />
        <span className="min-w-0 flex-1">
          <span className="text-xs font-semibold text-[var(--brand-primary)]">초안 {index + 1}</span>
          <span className="mt-1 block text-sm font-semibold text-[var(--text-primary)]">{item.title}</span>
          <span className="mt-1 block text-sm text-[var(--text-secondary)]">{item.description}</span>
        </span>
      </label>
      <div className="mt-3 grid gap-3 text-xs text-[var(--text-secondary)] md:grid-cols-2">
        <div>
          <span className="font-semibold text-[var(--text-primary)]">사전 조건</span>
          <p className="mt-1 leading-5">{item.preconditions || "-"}</p>
        </div>
        <div>
          <span className="font-semibold text-[var(--text-primary)]">태그</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {item.tags.map((tag, tagIndex) => (
              <span key={`${item.title}-${tag}-${tagIndex}`} className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </div>
      <ol className="mt-3 space-y-2 text-xs text-[var(--text-secondary)]">
        {item.steps.map((step, stepIndex) => (
          <li key={`${item.title}-step-${stepIndex}`} className="rounded-md bg-[var(--bg-subtle)] p-2">
            <div>
              <span className="font-semibold text-[var(--text-primary)]">{stepIndex + 1}. Action</span>
              <span className="ml-2">{step.action}</span>
            </div>
            <div className="mt-1">
              <span className="font-semibold text-[var(--text-primary)]">Expected</span>
              <span className="ml-2">{step.expectedResult || "-"}</span>
            </div>
          </li>
        ))}
      </ol>
    </article>
  );
}

function BulkButton({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="h-8 rounded-md border border-blue-200 bg-white px-3 text-sm font-medium text-[var(--brand-primary)] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
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

function isInFolder(
  testCaseFolderId: string,
  selectedFolderId: string,
  folders: TestFolder[],
) {
  if (testCaseFolderId === selectedFolderId) {
    return true;
  }

  return folders.some(
    (folder) =>
      folder.id === testCaseFolderId && folder.parentId === selectedFolderId,
  );
}

function withAllFolder(folders: TestFolder[]) {
  return folders.some((folder) => folder.id === "all")
    ? folders
    : [allFolder, ...folders];
}

function getDefaultFolderId(folders: TestFolder[]) {
  return folders.find((folder) => folder.id !== "all")?.id ?? "payment-checkout";
}

function mergeUpdatedTestCases(
  currentTestCases: TestCase[],
  updatedTestCases: TestCase[],
) {
  const updatedById = new Map(updatedTestCases.map((testCase) => [testCase.id, testCase]));

  return currentTestCases.map((testCase) => updatedById.get(testCase.id) ?? testCase);
}

async function requestData<T>(url: string, init?: RequestInit) {
  const isFormData = init?.body instanceof FormData;
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: T; error?: { message?: string } }
    | null;

  if (!response.ok || payload?.data === undefined) {
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
