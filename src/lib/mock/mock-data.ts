import type {
  Defect,
  Member,
  Priority,
  Project,
  ResultStatus,
  RunStatus,
  TestCase,
  TestFolder,
  TestRun,
} from "@/lib/domain/types";

export const mockProjects: Project[] = [
  createProject("demo-project", "결제 시스템 v2", "결제 모듈 개편", "#2563EB", "active", 72, 145, 89, 5, ["홍", "김", "이", "박", "최", "정"], "2시간 전", 9),
  createProject("signup-flow", "회원가입 플로우", "신규 가입 개선", "#10B981", "active", 95, 56, 53, 1, ["김", "이", "박"], "어제", 8),
  createProject("checkout-improvement", "체크아웃 개선", "장바구니 UX", "#8B5CF6", "active", 30, 42, 12, 0, ["홍", "최"], "3시간 전", 7),
  createProject("mobile-app-v3", "모바일 앱 v3", "iOS/Android 동시", "#F59E0B", "active", 60, 88, 50, 3, ["홍", "김", "박", "최"], "5시간 전", 6),
  createProject("admin-console", "관리자 페이지", "내부 도구 개편", "#EC4899", "active", 15, 23, 3, 1, ["이", "박"], "1일 전", 5),
  createProject("notification-system", "알림 시스템", "Push/SMS 통합", "#14B8A6", "completed", 100, 34, 34, 0, ["홍", "김", "이"], "2일 전", 4),
  createProject("api-v2-migration", "API v2 마이그레이션", "REST에서 GraphQL 전환", "#EF4444", "active", 45, 67, 28, 2, ["박", "최", "정"], "4시간 전", 3),
  createProject("search-rebuild", "검색 기능 개편", "Elasticsearch 도입", "#CA8A04", "active", 80, 39, 30, 1, ["홍", "정"], "6시간 전", 2),
  createProject("dark-mode", "다크모드 도입", "전체 UI 다크 테마", "#64748B", "archived", 25, 18, 4, 0, ["김", "최"], "1일 전", 1),
];

export const mockTestFolders: TestFolder[] = [
  { id: "all", label: "전체" },
  { id: "payment", label: "결제 모듈" },
  { id: "payment-checkout", label: "결제하기", parentId: "payment" },
  { id: "refund", label: "환불", parentId: "payment" },
  { id: "payment-method", label: "결제수단", parentId: "payment" },
  { id: "signup", label: "회원가입" },
  { id: "mypage", label: "마이페이지" },
  { id: "search", label: "검색" },
];

export const mockTestCases: TestCase[] = [
  createTestCase("TC-001", "정상 카드 결제 성공 시나리오", "high", "ready", "payment-checkout", ["smoke", "payment"], "홍길동", "2시간 전", "정상 카드 결제 경로를 검증합니다.", "테스트 계정으로 로그인되어 있다.\n장바구니에 상품 1개가 담겨 있다.", ["결제 페이지에 진입한다.", "카드 정보를 입력한다.", "결제하기 버튼을 클릭한다."], "결제가 완료되고 주문 완료 화면이 표시된다."),
  createTestCase("TC-002", "잔액 부족 시 결제 실패 처리", "high", "ready", "payment-checkout", ["payment", "error"], "홍길동", "2시간 전", "잔액 부족 카드 결제 실패 처리를 검증합니다.", "잔액 부족 테스트 카드가 준비되어 있다.", ["결제 페이지에 진입한다.", "잔액 부족 카드를 입력한다.", "결제를 시도한다."], "결제 실패 메시지가 표시되고 주문은 생성되지 않는다."),
  createTestCase("TC-003", "환불 요청 후 영수증 발행 확인", "medium", "ready", "refund", ["refund"], "김QA", "어제", "환불 완료 후 영수증 발행 가능 여부를 확인합니다.", "결제 완료 주문이 존재한다.", ["주문 상세로 이동한다.", "환불을 요청한다.", "영수증 메뉴를 확인한다."], "환불 영수증이 정상적으로 발행된다."),
  createTestCase("TC-004", "결제 수단 변경 후 재결제", "medium", "draft", "payment-method", ["payment"], "김QA", "어제", "실패 주문에서 결제 수단 변경 후 재결제를 확인합니다.", "결제 실패 주문이 존재한다.", ["결제 수단 변경을 선택한다.", "새 카드를 등록한다.", "재결제를 실행한다."], "새 결제 수단으로 결제가 완료된다."),
  createTestCase("TC-005", "결제 중 네트워크 단절 시 복구", "high", "ready", "payment-checkout", ["payment", "edge"], "홍길동", "2일 전", "결제 중 네트워크 단절 복구를 확인합니다.", "결제 진행 중 네트워크를 제어할 수 있다.", ["결제를 시작한다.", "네트워크를 끊는다.", "네트워크를 복구한다."], "결제 상태가 중복 없이 복구되고 안내 메시지가 표시된다."),
  createTestCase("TC-006", "카드 한도 초과 메시지 표시", "medium", "ready", "payment-checkout", ["card", "limit"], "이PM", "2일 전", "카드 한도 초과 시 안내 메시지를 검증합니다.", "한도 초과 테스트 카드가 준비되어 있다.", ["결제 페이지에 진입한다.", "한도 초과 카드를 입력한다.", "결제를 시도한다."], "한도 초과 안내가 표시되고 주문은 생성되지 않는다."),
  createTestCase("TC-007", "3D 인증 실패 후 재시도", "high", "draft", "payment-method", ["3ds", "payment"], "박개발", "3일 전", "3D 인증 실패 후 재시도 흐름을 확인합니다.", "3D 인증 테스트 카드가 준비되어 있다.", ["결제 페이지에 진입한다.", "3D 인증을 실패 처리한다.", "재시도를 선택한다."], "사용자가 인증을 다시 시도할 수 있다."),
  createTestCase("TC-008", "부분 환불 금액 계산 확인", "medium", "ready", "refund", ["refund", "amount"], "김QA", "3일 전", "부분 환불 금액 계산을 검증합니다.", "부분 환불 가능한 주문이 존재한다.", ["주문 상세로 이동한다.", "일부 상품을 선택한다.", "환불 예상 금액을 확인한다."], "환불 금액이 선택 상품 기준으로 정확히 계산된다."),
  createTestCase("TC-009", "신규 회원 가입 정상 플로우", "high", "ready", "signup", ["signup", "smoke"], "최QA", "4일 전", "신규 회원 가입 정상 경로를 확인합니다.", "미가입 이메일이 준비되어 있다.", ["회원가입 화면에 진입한다.", "필수 정보를 입력한다.", "가입하기를 클릭한다."], "가입이 완료되고 대시보드로 이동한다."),
  createTestCase("TC-010", "약관 미동의 시 가입 차단", "medium", "ready", "signup", ["signup", "terms"], "최QA", "4일 전", "필수 약관 미동의 시 가입 차단을 확인합니다.", "회원가입 화면에 진입할 수 있다.", ["필수 정보를 입력한다.", "필수 약관을 선택하지 않는다.", "가입하기를 클릭한다."], "가입이 차단되고 약관 동의 안내가 표시된다."),
  createTestCase("TC-011", "마이페이지 주문 내역 조회", "medium", "ready", "mypage", ["mypage", "order"], "홍길동", "5일 전", "마이페이지 주문 내역 조회를 확인합니다.", "주문 이력이 있는 계정으로 로그인되어 있다.", ["마이페이지에 진입한다.", "주문 내역 탭을 선택한다.", "주문 상세를 연다."], "주문 목록과 상세 정보가 정확히 표시된다."),
  createTestCase("TC-012", "검색어 자동완성 결과 표시", "low", "draft", "search", ["search"], "이PM", "5일 전", "검색어 자동완성 결과를 확인합니다.", "검색 인덱스가 준비되어 있다.", ["검색창에 키워드를 입력한다.", "자동완성 목록을 확인한다."], "관련 검색어가 우선순위에 따라 표시된다."),
];

export const mockTestRuns: TestRun[] = [
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
    cases: mockTestCases.slice(0, 8),
    statuses: mockTestCases.slice(0, 8).map(() => "pending"),
  }),
];

export const mockDefects: Defect[] = [
  createDefect("BUG-101", "잔액 부족 카드 결제 실패 시 주문이 생성됨", "잔액 부족 카드로 결제를 시도하면 실패 메시지가 표시되지만 일부 환경에서 주문 데이터가 생성됩니다.", "1. 테스트 계정으로 로그인\n2. 장바구니에 상품 추가\n3. 잔액 부족 테스트 카드 입력\n4. 결제하기 클릭\n5. 주문 내역 확인", ["실패 응답 코드 확인", "주문 생성 API 호출 여부 확인", "결제 실패 로그 수집"], "critical", "high", "open", "박개발", "김QA", "2026-05-14", "2026-05-16", "TC-002", "잔액 부족 시 결제 실패 처리", "sprint-12-regression-TC-002", 2),
  createDefect("BUG-102", "환불 완료 후 영수증 발행 버튼이 비활성화됨", "환불 완료 상태에서 영수증 발행 버튼이 간헐적으로 비활성화됩니다.", "1. 환불 완료 주문 상세 진입\n2. 영수증 영역 확인\n3. 새로고침 후 버튼 상태 비교", ["환불 상태 매핑 확인", "영수증 권한 조건 확인"], "major", "medium", "in_progress", "이프론트", "김QA", "2026-05-15", "2026-05-17", "TC-003", "환불 요청 후 영수증 발행 확인", "sprint-12-regression-TC-003", 1),
  createDefect("BUG-103", "검색 자동완성 결과가 이전 키워드 기준으로 표시됨", "빠르게 검색어를 변경하면 자동완성 목록이 이전 키워드 결과로 남아 있습니다.", "1. 검색창에 '카드' 입력\n2. 바로 '환불'로 변경\n3. 자동완성 목록 확인", ["debounce 취소 처리 확인", "응답 순서 보정 확인"], "minor", "low", "resolved", "최검색", "정QA", "2026-05-12", "2026-05-15", "TC-008", "검색어 자동완성 결과 표시", undefined, 0),
  createDefect("BUG-104", "마이페이지 주문 내역 정렬 아이콘 방향 불일치", "정렬 방향과 아이콘 방향이 일부 브라우저에서 반대로 표시됩니다.", "1. 마이페이지 주문 내역 진입\n2. 최신순 정렬 선택\n3. 정렬 아이콘 방향 확인", ["정렬 상태 label 확인", "아이콘 조건부 렌더링 확인"], "trivial", "low", "closed", "이프론트", "정QA", "2026-05-10", "2026-05-13", "TC-007", "마이페이지 주문 내역 조회", undefined, 0),
];

export const mockMembers: Member[] = [
  { id: "mem-1", name: "김QA", email: "qa.lead@testflow.local", role: "Admin", status: "active", lastActive: "방금 전" },
  { id: "mem-2", name: "박개발", email: "backend@testflow.local", role: "Member", status: "active", lastActive: "오늘 10:12" },
  { id: "mem-3", name: "이프론트", email: "frontend@testflow.local", role: "Member", status: "active", lastActive: "어제" },
  { id: "mem-4", name: "정PM", email: "pm@testflow.local", role: "Viewer", status: "active", lastActive: "3일 전" },
];

export const mockPendingInvites: Member[] = [
  { id: "inv-1", name: "초대 대기", email: "new.qa@testflow.local", role: "Member", status: "pending", lastActive: "2026-05-18 발송" },
  { id: "inv-2", name: "초대 대기", email: "viewer@testflow.local", role: "Viewer", status: "pending", lastActive: "2026-05-17 발송" },
];

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
  cases: TestCase[];
  statuses?: ResultStatus[];
}): TestRun {
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

function createProject(
  id: string,
  name: string,
  description: string,
  color: string,
  status: Project["status"],
  progress: number,
  testCaseCount: number,
  passCount: number,
  failCount: number,
  members: string[],
  updatedAtLabel: string,
  createdAtOrder: number,
): Project {
  return { id, name, description, color, status, progress, testCaseCount, passCount, failCount, members, updatedAtLabel, createdAtOrder };
}

function createTestCase(
  id: string,
  title: string,
  priority: Priority,
  status: TestCase["status"],
  folderId: string,
  tags: string[],
  author: string,
  updatedAtLabel: string,
  description: string,
  preconditions: string,
  steps: string[],
  expectedResult: string,
): TestCase {
  return { id, title, priority, status, folderId, tags, author, updatedAtLabel, description, preconditions, steps, expectedResult };
}

function createDefect(
  id: string,
  title: string,
  description: string,
  reproductionSteps: string,
  checklist: string[],
  severity: Defect["severity"],
  priority: Defect["priority"],
  status: Defect["status"],
  assignee: string,
  reporter: string,
  createdAt: string,
  updatedAt: string,
  linkedTestCaseId: string,
  linkedTestCaseTitle: string,
  linkedRunResultId: string | undefined,
  attachmentCount: number,
): Defect {
  return { id, title, description, reproductionSteps, checklist, severity, priority, status, assignee, reporter, createdAt, updatedAt, linkedTestCaseId, linkedTestCaseTitle, linkedRunResultId, attachmentCount };
}
