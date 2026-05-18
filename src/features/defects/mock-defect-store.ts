"use client";

export type DefectStatus = "open" | "in_progress" | "resolved" | "closed";
export type Severity = "critical" | "major" | "minor" | "trivial";
export type DefectPriority = "high" | "medium" | "low";

export type MockDefect = {
  id: string;
  title: string;
  description: string;
  reproductionSteps: string;
  checklist: string[];
  severity: Severity;
  priority: DefectPriority;
  status: DefectStatus;
  assignee: string;
  reporter: string;
  createdAt: string;
  updatedAt: string;
  linkedTestCaseId: string;
  linkedTestCaseTitle: string;
  linkedRunResultId?: string;
  attachmentCount: number;
};

const STORAGE_KEY = "testflow-v2:mock-defects";

const initialDefects: MockDefect[] = [
  {
    id: "BUG-101",
    title: "잔액 부족 카드 결제 실패 시 주문이 생성됨",
    description:
      "잔액 부족 카드로 결제를 시도하면 실패 메시지가 표시되지만 일부 환경에서 주문 데이터가 생성됩니다.",
    reproductionSteps:
      "1. 테스트 계정으로 로그인\n2. 장바구니에 상품 추가\n3. 잔액 부족 테스트 카드 입력\n4. 결제하기 클릭\n5. 주문 내역 확인",
    checklist: ["실패 응답 코드 확인", "주문 생성 API 호출 여부 확인", "결제 실패 로그 수집"],
    severity: "critical",
    priority: "high",
    status: "open",
    assignee: "박개발",
    reporter: "김QA",
    createdAt: "2026-05-14",
    updatedAt: "2026-05-16",
    linkedTestCaseId: "TC-002",
    linkedTestCaseTitle: "잔액 부족 시 결제 실패 처리",
    linkedRunResultId: "sprint-12-regression-TC-002",
    attachmentCount: 2,
  },
  {
    id: "BUG-102",
    title: "환불 완료 후 영수증 발행 버튼이 비활성화됨",
    description: "환불 완료 상태에서 영수증 발행 버튼이 간헐적으로 비활성화됩니다.",
    reproductionSteps:
      "1. 환불 완료 주문 상세 진입\n2. 영수증 영역 확인\n3. 새로고침 후 버튼 상태 비교",
    checklist: ["환불 상태 매핑 확인", "영수증 권한 조건 확인"],
    severity: "major",
    priority: "medium",
    status: "in_progress",
    assignee: "이프론트",
    reporter: "김QA",
    createdAt: "2026-05-15",
    updatedAt: "2026-05-17",
    linkedTestCaseId: "TC-003",
    linkedTestCaseTitle: "환불 요청 후 영수증 발행 확인",
    linkedRunResultId: "sprint-12-regression-TC-003",
    attachmentCount: 1,
  },
  {
    id: "BUG-103",
    title: "검색 자동완성 결과가 이전 키워드 기준으로 표시됨",
    description: "빠르게 검색어를 변경하면 자동완성 목록이 이전 키워드 결과로 남아 있습니다.",
    reproductionSteps:
      "1. 검색창에 '카드' 입력\n2. 바로 '환불'로 변경\n3. 자동완성 목록 확인",
    checklist: ["debounce 취소 처리 확인", "응답 순서 보정 확인"],
    severity: "minor",
    priority: "low",
    status: "resolved",
    assignee: "최검색",
    reporter: "정QA",
    createdAt: "2026-05-12",
    updatedAt: "2026-05-15",
    linkedTestCaseId: "TC-008",
    linkedTestCaseTitle: "검색어 자동완성 결과 표시",
    attachmentCount: 0,
  },
  {
    id: "BUG-104",
    title: "마이페이지 주문 내역 정렬 아이콘 방향 불일치",
    description: "정렬 방향과 아이콘 방향이 일부 브라우저에서 반대로 표시됩니다.",
    reproductionSteps:
      "1. 마이페이지 주문 내역 진입\n2. 최신순 정렬 선택\n3. 정렬 아이콘 방향 확인",
    checklist: ["정렬 상태 label 확인", "아이콘 조건부 렌더링 확인"],
    severity: "trivial",
    priority: "low",
    status: "closed",
    assignee: "이프론트",
    reporter: "정QA",
    createdAt: "2026-05-10",
    updatedAt: "2026-05-13",
    linkedTestCaseId: "TC-007",
    linkedTestCaseTitle: "마이페이지 주문 내역 조회",
    attachmentCount: 0,
  },
];

export function loadMockDefects() {
  if (typeof window === "undefined") {
    return initialDefects;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    saveMockDefects(initialDefects);
    return initialDefects;
  }

  try {
    return JSON.parse(raw) as MockDefect[];
  } catch {
    saveMockDefects(initialDefects);
    return initialDefects;
  }
}

export function saveMockDefects(defects: MockDefect[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(defects));
}

export function createDefectId(defects: MockDefect[]) {
  const maxId = defects.reduce((max, defect) => {
    const numericId = Number(defect.id.replace("BUG-", ""));
    return Number.isNaN(numericId) ? max : Math.max(max, numericId);
  }, 100);

  return `BUG-${maxId + 1}`;
}
