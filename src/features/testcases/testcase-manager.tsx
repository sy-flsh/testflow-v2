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
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { DialogShell } from "@/components/common/dialog-shell";
import { DrawerShell } from "@/components/common/drawer-shell";
import { FormField, SelectField, TextAreaField, TextInput } from "@/components/common/form-field";
import { TableActionBar } from "@/components/common/action-bar";
import { PriorityBadge } from "@/components/common/priority-badge";
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
  const [downloadNotice, setDownloadNotice] = useState(false);

  const apiBase = `/api/projects/${encodeURIComponent(projectId)}`;

  useEffect(() => {
    let active = true;

    async function loadData() {
      setIsLoading(true);
      setActionError("");
      setNotice("");

      try {
        const [apiFolders, apiTestCases] = await Promise.all([
          requestData<TestFolder[]>(`${apiBase}/test-folders`),
          requestData<TestCase[]>(`${apiBase}/test-cases`),
        ]);

        if (!active) {
          return;
        }

        const nextFolders = withAllFolder(apiFolders);
        setFolders(nextFolders);
        setTestCases(apiTestCases);
        saveTestCaseBackupSnapshot(projectId, nextFolders, apiTestCases);
        setIsBackupMode(false);
      } catch {
        if (!active) {
          return;
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
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, [apiBase, projectId]);

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

  function openNewDrawer() {
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
              <BulkButton onClick={deleteSelected}>삭제</BulkButton>
              <BulkButton onClick={addTagToSelected}>태그 추가</BulkButton>
              <BulkButton onClick={moveSelectedFolder}>폴더 이동</BulkButton>
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
        />
      )}

      {isUploadOpen && <ExcelUploadModal onClose={() => setUploadOpen(false)} />}
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
  folders,
  draft,
  submitted,
  submitError,
  onChange,
  onClose,
  onSave,
}: {
  folders: TestFolder[];
  draft: Draft;
  submitted: boolean;
  submitError?: string;
  onChange: (draft: Draft) => void;
  onClose: () => void;
  onSave: () => void;
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
            className="h-9 rounded-md bg-[var(--brand-primary)] px-3 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)]"
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
          />
        </FormField>

        <div className="grid gap-3 md:grid-cols-2">
          <FormField label="우선순위">
            <SelectField
              value={draft.priority}
              onChange={(event) => update("priority", event.target.value as Priority)}
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
            />
          </div>
        </FormField>

        <FormField label="설명">
          <TextAreaField
            value={draft.description}
            onChange={(event) => update("description", event.target.value)}
            rows={3}
          />
        </FormField>
        <FormField label="사전 조건">
          <TextAreaField
            value={draft.preconditions}
            onChange={(event) => update("preconditions", event.target.value)}
            rows={4}
          />
        </FormField>
        <FormField label="실행 단계">
          <TextAreaField
            value={draft.stepsText}
            onChange={(event) => update("stepsText", event.target.value)}
            rows={5}
            placeholder="1. 결제 페이지 진입&#10;2. 카드 정보 입력"
          />
        </FormField>
        <FormField label="기대 결과">
          <TextAreaField
            value={draft.expectedResult}
            onChange={(event) => update("expectedResult", event.target.value)}
            rows={4}
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

function ExcelUploadModal({ onClose }: { onClose: () => void }) {
  const [hasMockFile, setHasMockFile] = useState(false);

  return (
    <DialogShell
      title="엑셀 파일 업로드"
      description="먼저 표준 템플릿을 다운로드하세요. 실제 파일 파싱은 후속 단계에서 연결합니다."
      onClose={onClose}
      maxWidth="max-w-xl"
      footer={
        <div className="flex justify-end gap-2">
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
        </div>
      }
    >
      <div className="space-y-5">
        <button className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]">
          <Download className="h-4 w-4" />
          엑셀 템플릿 다운로드
        </button>
        <div className="rounded-lg border-2 border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)] px-6 py-10 text-center">
          <Upload className="mx-auto h-8 w-8 text-[var(--text-tertiary)]" />
          <p className="mt-3 text-sm font-medium">파일을 끌어다 놓거나 선택하세요</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">지원 예정: .xlsx, .xls, .csv</p>
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
            <PreviewItem ok={hasMockFile} text={hasMockFile ? "인식된 행: 45개" : "파일 선택 대기 중"} />
            <PreviewItem ok={hasMockFile} text="컬럼 매핑 확인" />
            <PreviewItem ok={!hasMockFile} warning text="2개 행에 누락된 필드" />
          </div>
        </section>
      </div>
    </DialogShell>
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
