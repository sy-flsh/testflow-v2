"use client";

export type RunStatus = "planned" | "in_progress" | "paused" | "completed";
export type ResultStatus = "pending" | "passed" | "failed" | "blocked" | "skipped";
export type Priority = "high" | "medium" | "low";

export type MockTestCase = {
  id: string;
  title: string;
  priority: Priority;
  folder: string;
  tags: string[];
  preconditions: string[];
  steps: string[];
  expectedResult: string;
};

export type MockRunResult = {
  id: string;
  testCase: MockTestCase;
  status: ResultStatus;
  actualResult: string;
  defectCount: number;
};

export type MockTestRun = {
  id: string;
  title: string;
  description: string;
  assignee: string;
  environment: string;
  startDate: string;
  dueDate: string;
  status: RunStatus;
  createdLabel: string;
  results: MockRunResult[];
};

const STORAGE_KEY = "testflow-v2:mock-test-runs";

export const mockTestCases: MockTestCase[] = [
  {
    id: "TC-001",
    title: "정상 카드 결제 성공 시나리오",
    priority: "high",
    folder: "결제하기",
    tags: ["smoke", "payment"],
    preconditions: ["테스트 계정으로 로그인되어 있다.", "장바구니에 상품 1개가 담겨 있다."],
    steps: ["결제 페이지에 진입한다.", "카드 정보를 입력한다.", "결제하기 버튼을 클릭한다."],
    expectedResult: "결제가 완료되고 주문 완료 화면이 표시된다.",
  },
  {
    id: "TC-002",
    title: "잔액 부족 시 결제 실패 처리",
    priority: "high",
    folder: "결제하기",
    tags: ["payment", "error"],
    preconditions: ["잔액 부족 테스트 카드가 준비되어 있다."],
    steps: ["결제 페이지에 진입한다.", "잔액 부족 카드를 입력한다.", "결제를 시도한다."],
    expectedResult: "결제 실패 메시지가 표시되고 주문은 생성되지 않는다.",
  },
  {
    id: "TC-003",
    title: "환불 요청 후 영수증 발행 확인",
    priority: "medium",
    folder: "환불",
    tags: ["refund"],
    preconditions: ["결제 완료 주문이 존재한다."],
    steps: ["주문 상세로 이동한다.", "환불을 요청한다.", "영수증 메뉴를 확인한다."],
    expectedResult: "환불 영수증이 정상적으로 발행된다.",
  },
  {
    id: "TC-004",
    title: "결제 수단 변경 후 재결제",
    priority: "medium",
    folder: "결제수단",
    tags: ["payment"],
    preconditions: ["결제 실패 주문이 존재한다."],
    steps: ["결제 수단 변경을 선택한다.", "새 카드를 등록한다.", "재결제를 실행한다."],
    expectedResult: "새 결제 수단으로 결제가 완료된다.",
  },
  {
    id: "TC-005",
    title: "결제 중 네트워크 단절 시 복구",
    priority: "high",
    folder: "결제하기",
    tags: ["payment", "edge"],
    preconditions: ["결제 진행 중 네트워크를 제어할 수 있다."],
    steps: ["결제를 시작한다.", "네트워크를 끊는다.", "네트워크를 복구한다."],
    expectedResult: "결제 상태가 중복 없이 복구되고 안내 메시지가 표시된다.",
  },
  {
    id: "TC-006",
    title: "신규 회원 가입 정상 플로우",
    priority: "high",
    folder: "회원가입",
    tags: ["signup", "smoke"],
    preconditions: ["미가입 이메일이 준비되어 있다."],
    steps: ["회원가입 화면에 진입한다.", "필수 정보를 입력한다.", "가입하기를 클릭한다."],
    expectedResult: "가입이 완료되고 대시보드로 이동한다.",
  },
  {
    id: "TC-007",
    title: "마이페이지 주문 내역 조회",
    priority: "medium",
    folder: "마이페이지",
    tags: ["mypage", "order"],
    preconditions: ["주문 이력이 있는 계정으로 로그인되어 있다."],
    steps: ["마이페이지에 진입한다.", "주문 내역 탭을 선택한다.", "주문 상세를 연다."],
    expectedResult: "주문 목록과 상세 정보가 정확히 표시된다.",
  },
  {
    id: "TC-008",
    title: "검색어 자동완성 결과 표시",
    priority: "low",
    folder: "검색",
    tags: ["search"],
    preconditions: ["검색 인덱스가 준비되어 있다."],
    steps: ["검색창에 키워드를 입력한다.", "자동완성 목록을 확인한다."],
    expectedResult: "관련 검색어가 우선순위에 따라 표시된다.",
  },
];

const initialRuns: MockTestRun[] = [
  createRun({
    id: "sprint-12-regression",
    title: "Sprint 12 회귀 테스트",
    description: "결제와 회원가입 주요 플로우 회귀 검증",
    assignee: "김QA",
    environment: "QA Server",
    startDate: "2026-05-14",
    dueDate: "2026-05-17",
    status: "in_progress",
    createdLabel: "어제 시작",
    cases: mockTestCases.slice(0, 5),
    statuses: ["passed", "passed", "failed", "blocked", "pending"],
  }),
  createRun({
    id: "payment-smoke",
    title: "결제 모듈 Smoke Test",
    description: "릴리즈 전 결제 핵심 경로 검증",
    assignee: "홍길동",
    environment: "Staging",
    startDate: "2026-05-12",
    dueDate: "2026-05-12",
    status: "completed",
    createdLabel: "2일 전",
    cases: mockTestCases.slice(0, 4),
    statuses: ["passed", "passed", "failed", "passed"],
  }),
  createRun({
    id: "release-final-check",
    title: "출시 전 최종 검증",
    description: "출시 후보 빌드 최종 확인",
    assignee: "김QA",
    environment: "Prod Mirror",
    startDate: "2026-05-20",
    dueDate: "2026-05-21",
    status: "planned",
    createdLabel: "다음주 월요일",
    cases: mockTestCases,
    statuses: mockTestCases.map(() => "pending"),
  }),
];

export function loadMockRuns() {
  if (typeof window === "undefined") {
    return initialRuns;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    saveMockRuns(initialRuns);
    return initialRuns;
  }

  try {
    return JSON.parse(raw) as MockTestRun[];
  } catch {
    saveMockRuns(initialRuns);
    return initialRuns;
  }
}

export function saveMockRuns(runs: MockTestRun[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
}

export function createRun(input: {
  id: string;
  title: string;
  description: string;
  assignee: string;
  environment: string;
  startDate: string;
  dueDate: string;
  status: RunStatus;
  createdLabel: string;
  cases: MockTestCase[];
  statuses?: ResultStatus[];
}): MockTestRun {
  return {
    id: input.id,
    title: input.title,
    description: input.description,
    assignee: input.assignee,
    environment: input.environment,
    startDate: input.startDate,
    dueDate: input.dueDate,
    status: input.status,
    createdLabel: input.createdLabel,
    results: input.cases.map((testCase, index) => ({
      id: `${input.id}-${testCase.id}`,
      testCase,
      status: input.statuses?.[index] ?? "pending",
      actualResult: "",
      defectCount:
        input.statuses?.[index] === "failed" || input.statuses?.[index] === "blocked"
          ? 1
          : 0,
    })),
  };
}

export function summarizeRun(run: MockTestRun) {
  const total = run.results.length;
  const pass = run.results.filter((result) => result.status === "passed").length;
  const fail = run.results.filter((result) => result.status === "failed").length;
  const block = run.results.filter((result) => result.status === "blocked").length;
  const skip = run.results.filter((result) => result.status === "skipped").length;
  const done = run.results.filter((result) => result.status !== "pending").length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  return { total, done, pass, fail, block, skip, progress };
}

export function toRunId(title: string) {
  const normalized = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || `run-${Date.now()}`;
}
