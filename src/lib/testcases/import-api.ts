import Papa from "papaparse";
import type { Priority, TestCaseStatus } from "@/lib/domain/types";
import { parsePriority, parseTestCaseStatus, toDbPriority, toDbTestCaseStatus } from "@/lib/testcases/testcase-api";

export type ImportStep = {
  action: string;
  expectedResult: string;
};

export type TestCaseImportMappedRow = {
  folder: string;
  folderId?: string;
  title: string;
  description: string;
  preconditions: string;
  priority: Priority;
  status: TestCaseStatus;
  tags: string[];
  steps: ImportStep[];
};

export type TestCaseImportPreviewRow = {
  rowNumber: number;
  mapped: TestCaseImportMappedRow;
  errors: string[];
  warnings: string[];
  status: "valid" | "error";
};

export type TestCaseImportPreview = {
  totalRows: number;
  validRows: number;
  errorRows: number;
  rows: TestCaseImportPreviewRow[];
};

export type FolderLookup = Array<{
  id: string;
  slug: string;
  name: string;
}>;

type CsvRow = Record<string, string>;

const columnAliases: Record<string, string[]> = {
  folder: ["folder", "폴더", "folder_name", "folderName", "카테고리", "모듈"],
  title: ["title", "제목", "테스트케이스", "테스트케이스명", "tc_title", "name"],
  description: ["description", "설명", "상세", "내용"],
  preconditions: ["preconditions", "precondition", "사전조건", "사전 조건", "전제조건", "전제 조건"],
  priority: ["priority", "우선순위", "중요도"],
  status: ["status", "상태"],
  tags: ["tags", "tag", "태그", "labels", "라벨"],
};

const priorityAliases: Record<string, Priority> = {
  high: "high",
  h: "high",
  높음: "high",
  상: "high",
  medium: "medium",
  med: "medium",
  m: "medium",
  보통: "medium",
  중: "medium",
  low: "low",
  l: "low",
  낮음: "low",
  하: "low",
};

const statusAliases: Record<string, TestCaseStatus> = {
  ready: "ready",
  준비: "ready",
  완료: "ready",
  draft: "draft",
  초안: "draft",
  작성중: "draft",
  deprecated: "deprecated",
  폐기: "deprecated",
  사용안함: "deprecated",
};

export function parseCsvImport(csvText: string, folders: FolderLookup): TestCaseImportPreview {
  const parsed = Papa.parse<CsvRow>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
    transform: (value) => value.trim(),
  });
  const rows = parsed.data.filter((row) =>
    Object.values(row).some((value) => typeof value === "string" && value.trim()),
  );
  const previewRows = rows.map((row, index) => mapCsvRow(row, index + 2, folders));

  for (const error of parsed.errors) {
    const rowNumber = typeof error.row === "number" ? error.row + 2 : 1;
    previewRows.push({
      rowNumber,
      mapped: createEmptyMappedRow(folders),
      errors: [`CSV 파싱 오류: ${error.message}`],
      warnings: [],
      status: "error",
    });
  }

  return {
    totalRows: previewRows.length,
    validRows: previewRows.filter((row) => row.status === "valid").length,
    errorRows: previewRows.filter((row) => row.status === "error").length,
    rows: previewRows,
  };
}

export function sanitizeImportRows(
  rows: unknown,
  folders: FolderLookup,
): { rows: TestCaseImportPreviewRow[]; errors: string[] } {
  if (!Array.isArray(rows)) {
    return { rows: [], errors: ["commit rows payload가 배열이 아닙니다."] };
  }

  const sanitizedRows = rows.map((row, index) => sanitizeImportRow(row, index + 1, folders));
  const errors = sanitizedRows.flatMap((row) => row.errors.map((error) => `${row.rowNumber}행: ${error}`));

  return {
    rows: sanitizedRows.filter((row) => row.status === "valid"),
    errors,
  };
}

export function getDbPriority(priority: Priority) {
  return toDbPriority(priority);
}

export function getDbStatus(status: TestCaseStatus) {
  return toDbTestCaseStatus(status);
}

function mapCsvRow(row: CsvRow, rowNumber: number, folders: FolderLookup): TestCaseImportPreviewRow {
  const mapped: TestCaseImportMappedRow = {
    folder: readCell(row, columnAliases.folder),
    title: readCell(row, columnAliases.title),
    description: readCell(row, columnAliases.description),
    preconditions: readCell(row, columnAliases.preconditions),
    priority: normalizePriority(readCell(row, columnAliases.priority)),
    status: normalizeStatus(readCell(row, columnAliases.status)),
    tags: splitTags(readCell(row, columnAliases.tags)),
    steps: readSteps(row),
  };
  const { errors, warnings } = validateMappedRow(mapped, folders);
  const folder = findFolder(folders, mapped.folder);

  mapped.folderId = folder?.id;

  return {
    rowNumber,
    mapped,
    errors,
    warnings,
    status: errors.length > 0 ? "error" : "valid",
  };
}

function sanitizeImportRow(
  row: unknown,
  rowNumber: number,
  folders: FolderLookup,
): TestCaseImportPreviewRow {
  const candidate = isRecord(row) && isRecord(row.mapped) ? row.mapped : isRecord(row) ? row : {};
  const mapped: TestCaseImportMappedRow = {
    folder: readCandidateString(candidate.folder),
    folderId: readCandidateString(candidate.folderId) || undefined,
    title: readCandidateString(candidate.title),
    description: readCandidateString(candidate.description),
    preconditions: readCandidateString(candidate.preconditions),
    priority: normalizePriority(readCandidateString(candidate.priority)),
    status: normalizeStatus(readCandidateString(candidate.status)),
    tags: Array.isArray(candidate.tags)
      ? candidate.tags.map((tag) => readCandidateString(tag)).filter(Boolean)
      : splitTags(readCandidateString(candidate.tags)),
    steps: Array.isArray(candidate.steps)
      ? candidate.steps
          .map((step) => {
            if (typeof step === "string") {
              return { action: step.trim(), expectedResult: "" };
            }

            if (!isRecord(step)) {
              return { action: "", expectedResult: "" };
            }

            return {
              action: readCandidateString(step.action),
              expectedResult: readCandidateString(step.expectedResult),
            };
          })
          .filter((step) => step.action || step.expectedResult)
      : [],
  };
  const folder = mapped.folderId
    ? folders.find((item) => item.id === mapped.folderId)
    : findFolder(folders, mapped.folder);

  mapped.folderId = folder?.id;

  const { errors, warnings } = validateMappedRow(mapped, folders);

  return {
    rowNumber: isRecord(row) && typeof row.rowNumber === "number" ? row.rowNumber : rowNumber,
    mapped,
    errors,
    warnings,
    status: errors.length > 0 ? "error" : "valid",
  };
}

function validateMappedRow(mapped: TestCaseImportMappedRow, folders: FolderLookup) {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!mapped.title) {
    errors.push("title은 필수입니다.");
  }

  if (!parsePriority(mapped.priority)) {
    errors.push("priority는 high, medium, low 중 하나여야 합니다.");
  }

  if (!parseTestCaseStatus(mapped.status)) {
    errors.push("status는 ready, draft, deprecated 중 하나여야 합니다.");
  }

  if (mapped.folder && !findFolder(folders, mapped.folder)) {
    warnings.push("폴더 이름이 기존 폴더와 매칭되지 않아 기본 폴더에 저장됩니다.");
  }

  if (mapped.steps.length === 0) {
    warnings.push("실행 단계가 없어 빈 단계로 생성됩니다.");
  }

  return { errors, warnings };
}

function readCell(row: CsvRow, aliases: string[]) {
  const keys = Object.keys(row);
  const foundKey = keys.find((key) => aliases.some((alias) => normalizeKey(alias) === normalizeKey(key)));

  return foundKey ? row[foundKey]?.trim() ?? "" : "";
}

function readSteps(row: CsvRow) {
  const steps: ImportStep[] = [];

  for (let index = 1; index <= 3; index += 1) {
    const action = readCell(row, [
      `step${index}_action`,
      `step${index} action`,
      `step_${index}_action`,
      `단계${index}`,
      `단계${index}_액션`,
      `${index}단계`,
    ]);
    const expectedResult = readCell(row, [
      `step${index}_expected`,
      `step${index} expected`,
      `step_${index}_expected`,
      `단계${index}_기대결과`,
      `기대결과${index}`,
      `${index}단계_기대결과`,
    ]);

    if (action || expectedResult) {
      steps.push({ action, expectedResult });
    }
  }

  return steps;
}

function normalizePriority(value: string): Priority {
  const normalized = normalizeValue(value);

  return priorityAliases[normalized] ?? "medium";
}

function normalizeStatus(value: string): TestCaseStatus {
  const normalized = normalizeValue(value);

  return statusAliases[normalized] ?? "draft";
}

function splitTags(value: string) {
  return value
    .split(/[,\n]/)
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean);
}

function findFolder(folders: FolderLookup, value: string) {
  const normalized = normalizeValue(value);

  if (!normalized) {
    return null;
  }

  return (
    folders.find(
      (folder) =>
        normalizeValue(folder.name) === normalized ||
        normalizeValue(folder.slug) === normalized ||
        normalizeValue(folder.id) === normalized,
    ) ?? null
  );
}

function createEmptyMappedRow(folders: FolderLookup): TestCaseImportMappedRow {
  return {
    folder: folders[0]?.name ?? "",
    folderId: folders[0]?.id,
    title: "",
    description: "",
    preconditions: "",
    priority: "medium",
    status: "draft",
    tags: [],
    steps: [],
  };
}

function readCandidateString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function normalizeValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
