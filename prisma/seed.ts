import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL 환경 변수가 필요합니다.");
}

const adapter = new PrismaPg(databaseUrl);
const prisma = new PrismaClient({ adapter });

const workspaceSeed = {
  name: "TestFlow QA",
  slug: "testflow-qa",
  description: "TestFlow v2 기본 워크스페이스",
  timezone: "Asia/Seoul",
  logoUrl: null,
};

const devPassword = "password123!";

const users = [
  { email: "qa.lead@testflow.local", name: "김QA", role: "ADMIN" as const },
  { email: "backend@testflow.local", name: "박개발", role: "MEMBER" as const },
  { email: "frontend@testflow.local", name: "이프론트", role: "MEMBER" as const },
  { email: "pm@testflow.local", name: "정PM", role: "VIEWER" as const },
];

const projects = [
  {
    name: "결제 시스템 v2",
    slug: "demo-project",
    description: "결제 모듈 개편",
    color: "#2563EB",
    status: "ACTIVE" as const,
  },
  {
    name: "회원가입 플로우",
    slug: "signup-flow",
    description: "신규 가입 개선",
    color: "#10B981",
    status: "ACTIVE" as const,
  },
  {
    name: "체크아웃 개선",
    slug: "checkout-improvement",
    description: "장바구니 UX",
    color: "#8B5CF6",
    status: "ACTIVE" as const,
  },
  {
    name: "모바일 앱 v3",
    slug: "mobile-app-v3",
    description: "iOS/Android 동시",
    color: "#F59E0B",
    status: "ACTIVE" as const,
  },
  {
    name: "알림 시스템",
    slug: "notification-system",
    description: "Push/SMS 통합",
    color: "#14B8A6",
    status: "COMPLETED" as const,
  },
];

const testFolders = [
  { slug: "payment", name: "결제 모듈", parentSlug: null, sortOrder: 10 },
  { slug: "payment-checkout", name: "결제하기", parentSlug: "payment", sortOrder: 20 },
  { slug: "refund", name: "환불", parentSlug: "payment", sortOrder: 30 },
  { slug: "payment-method", name: "결제수단", parentSlug: "payment", sortOrder: 40 },
  { slug: "signup", name: "회원가입", parentSlug: null, sortOrder: 50 },
  { slug: "mypage", name: "마이페이지", parentSlug: null, sortOrder: 60 },
  { slug: "search", name: "검색", parentSlug: null, sortOrder: 70 },
];

const testCases = [
  createTestCaseSeed("TC-001", "정상 카드 결제 성공 시나리오", "HIGH", "READY", "payment-checkout", ["smoke", "payment"], "홍길동", "정상 카드 결제 경로를 검증합니다.", "테스트 계정으로 로그인되어 있다.\n장바구니에 상품 1개가 담겨 있다.", ["결제 페이지에 진입한다.", "카드 정보를 입력한다.", "결제하기 버튼을 클릭한다."], "결제가 완료되고 주문 완료 화면이 표시된다."),
  createTestCaseSeed("TC-002", "잔액 부족 시 결제 실패 처리", "HIGH", "READY", "payment-checkout", ["payment", "error"], "홍길동", "잔액 부족 카드 결제 실패 처리를 검증합니다.", "잔액 부족 테스트 카드가 준비되어 있다.", ["결제 페이지에 진입한다.", "잔액 부족 카드를 입력한다.", "결제를 시도한다."], "결제 실패 메시지가 표시되고 주문은 생성되지 않는다."),
  createTestCaseSeed("TC-003", "환불 요청 후 영수증 발행 확인", "MEDIUM", "READY", "refund", ["refund"], "김QA", "환불 완료 후 영수증 발행 가능 여부를 확인합니다.", "결제 완료 주문이 존재한다.", ["주문 상세로 이동한다.", "환불을 요청한다.", "영수증 메뉴를 확인한다."], "환불 영수증이 정상적으로 발행된다."),
  createTestCaseSeed("TC-004", "결제 수단 변경 후 재결제", "MEDIUM", "DRAFT", "payment-method", ["payment"], "김QA", "실패 주문에서 결제 수단 변경 후 재결제를 확인합니다.", "결제 실패 주문이 존재한다.", ["결제 수단 변경을 선택한다.", "새 카드를 등록한다.", "재결제를 실행한다."], "새 결제 수단으로 결제가 완료된다."),
  createTestCaseSeed("TC-005", "결제 중 네트워크 단절 시 복구", "HIGH", "READY", "payment-checkout", ["payment", "edge"], "홍길동", "결제 중 네트워크 단절 복구를 확인합니다.", "결제 진행 중 네트워크를 제어할 수 있다.", ["결제를 시작한다.", "네트워크를 끊는다.", "네트워크를 복구한다."], "결제 상태가 중복 없이 복구되고 안내 메시지가 표시된다."),
  createTestCaseSeed("TC-006", "카드 한도 초과 메시지 표시", "MEDIUM", "READY", "payment-checkout", ["card", "limit"], "이PM", "카드 한도 초과 시 안내 메시지를 검증합니다.", "한도 초과 테스트 카드가 준비되어 있다.", ["결제 페이지에 진입한다.", "한도 초과 카드를 입력한다.", "결제를 시도한다."], "한도 초과 안내가 표시되고 주문은 생성되지 않는다."),
  createTestCaseSeed("TC-007", "3D 인증 실패 후 재시도", "HIGH", "DRAFT", "payment-method", ["3ds", "payment"], "박개발", "3D 인증 실패 후 재시도 흐름을 확인합니다.", "3D 인증 테스트 카드가 준비되어 있다.", ["결제 페이지에 진입한다.", "3D 인증을 실패 처리한다.", "재시도를 선택한다."], "사용자가 인증을 다시 시도할 수 있다."),
  createTestCaseSeed("TC-008", "부분 환불 금액 계산 확인", "MEDIUM", "READY", "refund", ["refund", "amount"], "김QA", "부분 환불 금액 계산을 검증합니다.", "부분 환불 가능한 주문이 존재한다.", ["주문 상세로 이동한다.", "일부 상품을 선택한다.", "환불 예상 금액을 확인한다."], "환불 금액이 선택 상품 기준으로 정확히 계산된다."),
  createTestCaseSeed("TC-009", "신규 회원 가입 정상 플로우", "HIGH", "READY", "signup", ["signup", "smoke"], "최QA", "신규 회원 가입 정상 경로를 확인합니다.", "미가입 이메일이 준비되어 있다.", ["회원가입 화면에 진입한다.", "필수 정보를 입력한다.", "가입하기를 클릭한다."], "가입이 완료되고 대시보드로 이동한다."),
  createTestCaseSeed("TC-010", "약관 미동의 시 가입 차단", "MEDIUM", "READY", "signup", ["signup", "terms"], "최QA", "필수 약관 미동의 시 가입 차단을 확인합니다.", "회원가입 화면에 진입할 수 있다.", ["필수 정보를 입력한다.", "필수 약관을 선택하지 않는다.", "가입하기를 클릭한다."], "가입이 차단되고 약관 동의 안내가 표시된다."),
  createTestCaseSeed("TC-011", "마이페이지 주문 내역 조회", "MEDIUM", "READY", "mypage", ["mypage", "order"], "홍길동", "마이페이지 주문 내역 조회를 확인합니다.", "주문 이력이 있는 계정으로 로그인되어 있다.", ["마이페이지에 진입한다.", "주문 내역 탭을 선택한다.", "주문 상세를 연다."], "주문 목록과 상세 정보가 정확히 표시된다."),
  createTestCaseSeed("TC-012", "검색어 자동완성 결과 표시", "LOW", "DRAFT", "search", ["search"], "이PM", "검색어 자동완성 결과를 확인합니다.", "검색 인덱스가 준비되어 있다.", ["검색창에 키워드를 입력한다.", "자동완성 목록을 확인한다."], "관련 검색어가 우선순위에 따라 표시된다."),
];

const testRuns = [
  createRunSeed(
    "sprint-12-regression",
    "Sprint 12 회귀 테스트",
    "결제와 회원가입 주요 플로우 회귀 검증",
    "김QA",
    "QA Server",
    "2026-05-14",
    "2026-05-17",
    "IN_PROGRESS",
    [
      ["TC-001", "PASSED"],
      ["TC-002", "PASSED"],
      ["TC-003", "FAILED"],
      ["TC-004", "BLOCKED"],
      ["TC-005", "PENDING"],
    ],
  ),
  createRunSeed(
    "payment-smoke",
    "결제 모듈 Smoke Test",
    "릴리즈 전 결제 핵심 경로 검증",
    "홍길동",
    "Staging",
    "2026-05-12",
    "2026-05-12",
    "COMPLETED",
    [
      ["TC-001", "PASSED"],
      ["TC-002", "PASSED"],
      ["TC-003", "FAILED"],
      ["TC-004", "PASSED"],
    ],
  ),
  createRunSeed(
    "release-final-check",
    "출시 전 최종 검증",
    "출시 후보 빌드 최종 확인",
    "김QA",
    "Prod Mirror",
    "2026-05-20",
    "2026-05-21",
    "PLANNED",
    [
      ["TC-001", "PENDING"],
      ["TC-002", "PENDING"],
      ["TC-003", "PENDING"],
      ["TC-004", "PENDING"],
      ["TC-005", "PENDING"],
      ["TC-006", "PENDING"],
      ["TC-007", "PENDING"],
      ["TC-008", "PENDING"],
    ],
  ),
];

const defects = [
  createDefectSeed(
    "BUG-001",
    "환불 완료 후 영수증 발행 버튼이 비활성화됨",
    "환불 완료 상태에서 영수증 발행 버튼이 간헐적으로 비활성화됩니다.",
    "1. 환불 완료 주문 상세 진입\n2. 영수증 영역 확인\n3. 새로고침 후 버튼 상태 비교",
    ["환불 상태 매핑 확인", "영수증 권한 조건 확인"],
    "MAJOR",
    "MEDIUM",
    "IN_PROGRESS",
    "이프론트",
    "김QA",
    ["TC-003"],
    ["sprint-12-regression-TC-003", "payment-smoke-TC-003"],
    1,
  ),
  createDefectSeed(
    "BUG-002",
    "결제 수단 변경 후 재결제 환경 차단",
    "QA Server에서 재결제 인증 모듈이 간헐적으로 응답하지 않습니다.",
    "1. 결제 실패 주문 진입\n2. 결제 수단 변경 선택\n3. 새 카드 등록 후 재결제 실행",
    ["인증 모듈 상태 확인", "환경 변수 재확인", "재시도 로그 수집"],
    "CRITICAL",
    "HIGH",
    "OPEN",
    "박개발",
    "김QA",
    ["TC-004"],
    ["sprint-12-regression-TC-004"],
    2,
  ),
  createDefectSeed(
    "BUG-003",
    "잔액 부족 결제 실패 메시지 문구 불일치",
    "잔액 부족 카드 결제 실패 시 화면과 API 메시지가 서로 다르게 표시됩니다.",
    "1. 잔액 부족 테스트 카드 입력\n2. 결제 시도\n3. 오류 메시지 비교",
    ["프론트 메시지 키 확인", "PG 응답 코드 매핑 확인"],
    "MINOR",
    "MEDIUM",
    "RESOLVED",
    "이프론트",
    "홍길동",
    ["TC-002"],
    [],
    0,
  ),
  createDefectSeed(
    "BUG-004",
    "3D 인증 재시도 버튼 포커스 스타일 누락",
    "키보드 탐색 시 3D 인증 재시도 버튼의 포커스 상태가 명확하지 않습니다.",
    "1. 3D 인증 실패 상태 진입\n2. Tab으로 재시도 버튼 이동\n3. 포커스 스타일 확인",
    ["접근성 포커스 링 적용", "키보드 탐색 회귀 확인"],
    "TRIVIAL",
    "LOW",
    "CLOSED",
    "최검색",
    "정PM",
    ["TC-007"],
    [],
    0,
  ),
  createDefectSeed(
    "BUG-005",
    "부분 환불 금액 계산 시 쿠폰 할인 반영 누락",
    "부분 환불 금액 계산에서 쿠폰 할인 금액이 일부 케이스에 반영되지 않습니다.",
    "1. 쿠폰 적용 주문 생성\n2. 일부 상품 환불 선택\n3. 환불 예상 금액 확인",
    ["쿠폰 할인 배분 로직 확인", "부분 환불 단위 테스트 추가"],
    "MAJOR",
    "HIGH",
    "OPEN",
    "박개발",
    "김QA",
    ["TC-008"],
    [],
    1,
  ),
];

async function main() {
  const devPasswordHash = await bcrypt.hash(devPassword, 12);
  const workspace = await prisma.workspace.upsert({
    where: { slug: workspaceSeed.slug },
    update: workspaceSeed,
    create: workspaceSeed,
  });

  for (const userSeed of users) {
    const user = await prisma.user.upsert({
      where: { email: userSeed.email },
      update: {
        name: userSeed.name,
        passwordHash: devPasswordHash,
      },
      create: {
        email: userSeed.email,
        name: userSeed.name,
        passwordHash: devPasswordHash,
      },
    });

    await prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: user.id,
        },
      },
      update: {
        role: userSeed.role,
        status: "ACTIVE",
      },
      create: {
        workspaceId: workspace.id,
        userId: user.id,
        role: userSeed.role,
        status: "ACTIVE",
      },
    });
  }

  for (const projectSeed of projects) {
    await prisma.project.upsert({
      where: {
        workspaceId_slug: {
          workspaceId: workspace.id,
          slug: projectSeed.slug,
        },
      },
      update: {
        name: projectSeed.name,
        description: projectSeed.description,
        color: projectSeed.color,
        status: projectSeed.status,
      },
      create: {
        workspaceId: workspace.id,
        ...projectSeed,
      },
    });
  }

  const demoProject = await prisma.project.findUniqueOrThrow({
    where: {
      workspaceId_slug: {
        workspaceId: workspace.id,
        slug: "demo-project",
      },
    },
  });

  const folderBySlug = new Map<string, string>();

  for (const folderSeed of testFolders.filter((folder) => !folder.parentSlug)) {
    const folder = await prisma.testFolder.upsert({
      where: {
        projectId_slug: {
          projectId: demoProject.id,
          slug: folderSeed.slug,
        },
      },
      update: {
        name: folderSeed.name,
        sortOrder: folderSeed.sortOrder,
        parentId: null,
        deletedAt: null,
      },
      create: {
        projectId: demoProject.id,
        slug: folderSeed.slug,
        name: folderSeed.name,
        sortOrder: folderSeed.sortOrder,
      },
    });

    folderBySlug.set(folder.slug, folder.id);
  }

  for (const folderSeed of testFolders.filter((folder) => folder.parentSlug)) {
    const parentId = folderBySlug.get(folderSeed.parentSlug ?? "");

    const folder = await prisma.testFolder.upsert({
      where: {
        projectId_slug: {
          projectId: demoProject.id,
          slug: folderSeed.slug,
        },
      },
      update: {
        name: folderSeed.name,
        sortOrder: folderSeed.sortOrder,
        parentId,
        deletedAt: null,
      },
      create: {
        projectId: demoProject.id,
        parentId,
        slug: folderSeed.slug,
        name: folderSeed.name,
        sortOrder: folderSeed.sortOrder,
      },
    });

    folderBySlug.set(folder.slug, folder.id);
  }

  for (const testCaseSeed of testCases) {
    const folderId = folderBySlug.get(testCaseSeed.folderSlug);

    if (!folderId) {
      throw new Error(`Seed folder not found: ${testCaseSeed.folderSlug}`);
    }

    const testCase = await prisma.testCase.upsert({
      where: {
        projectId_code: {
          projectId: demoProject.id,
          code: testCaseSeed.code,
        },
      },
      update: {
        folderId,
        title: testCaseSeed.title,
        priority: testCaseSeed.priority,
        status: testCaseSeed.status,
        tags: testCaseSeed.tags,
        authorName: testCaseSeed.authorName,
        description: testCaseSeed.description,
        preconditions: testCaseSeed.preconditions,
        expectedResult: testCaseSeed.expectedResult,
        deletedAt: null,
      },
      create: {
        projectId: demoProject.id,
        folderId,
        code: testCaseSeed.code,
        title: testCaseSeed.title,
        priority: testCaseSeed.priority,
        status: testCaseSeed.status,
        tags: testCaseSeed.tags,
        authorName: testCaseSeed.authorName,
        description: testCaseSeed.description,
        preconditions: testCaseSeed.preconditions,
        expectedResult: testCaseSeed.expectedResult,
      },
    });

    await prisma.testStep.deleteMany({
      where: { testCaseId: testCase.id },
    });

    await prisma.testStep.createMany({
      data: testCaseSeed.steps.map((step, index) => ({
        testCaseId: testCase.id,
        order: index + 1,
        action: step,
      })),
    });
  }

  const testCaseByCode = new Map(
    await prisma.testCase
      .findMany({
        where: {
          projectId: demoProject.id,
          deletedAt: null,
        },
        select: { id: true, code: true },
      })
      .then((items) => items.map((item) => [item.code, item.id] as const)),
  );

  for (const runSeed of testRuns) {
    const run = await prisma.testRun.upsert({
      where: {
        projectId_slug: {
          projectId: demoProject.id,
          slug: runSeed.slug,
        },
      },
      update: {
        title: runSeed.title,
        description: runSeed.description,
        assigneeName: runSeed.assigneeName,
        environment: runSeed.environment,
        startDate: toUtcDate(runSeed.startDate),
        dueDate: toUtcDate(runSeed.dueDate),
        status: runSeed.status,
        deletedAt: null,
      },
      create: {
        projectId: demoProject.id,
        slug: runSeed.slug,
        title: runSeed.title,
        description: runSeed.description,
        assigneeName: runSeed.assigneeName,
        environment: runSeed.environment,
        startDate: toUtcDate(runSeed.startDate),
        dueDate: toUtcDate(runSeed.dueDate),
        status: runSeed.status,
      },
    });

    await prisma.testRunResult.deleteMany({
      where: { runId: run.id },
    });

    for (const [testCaseCode, status] of runSeed.results) {
      const testCaseId = testCaseByCode.get(testCaseCode);

      if (!testCaseId) {
        throw new Error(`Seed test case not found: ${testCaseCode}`);
      }

      await prisma.testRunResult.create({
        data: {
          runId: run.id,
          testCaseId,
          code: `${runSeed.slug}-${testCaseCode}`,
          status,
          actualResult:
            status === "PASSED"
              ? "기대 결과와 동일하게 동작함"
              : status === "FAILED"
                ? "실행 중 오류 재현됨"
                : status === "BLOCKED"
                  ? "환경 이슈로 실행 차단"
                  : "",
          defectCount: status === "FAILED" || status === "BLOCKED" ? 1 : 0,
        },
      });
    }
  }

  const testRunResultByCode = new Map(
    await prisma.testRunResult
      .findMany({
        where: {
          run: {
            projectId: demoProject.id,
            deletedAt: null,
          },
        },
        select: { id: true, code: true },
      })
      .then((items) => items.map((item) => [item.code, item.id] as const)),
  );

  for (const defectSeed of defects) {
    const defect = await prisma.defect.upsert({
      where: {
        projectId_code: {
          projectId: demoProject.id,
          code: defectSeed.code,
        },
      },
      update: {
        title: defectSeed.title,
        description: defectSeed.description,
        reproductionSteps: defectSeed.reproductionSteps,
        checklist: defectSeed.checklist,
        severity: defectSeed.severity,
        priority: defectSeed.priority,
        status: defectSeed.status,
        assigneeName: defectSeed.assigneeName,
        reporterName: defectSeed.reporterName,
        attachmentCount: defectSeed.attachmentCount,
        deletedAt: null,
      },
      create: {
        projectId: demoProject.id,
        code: defectSeed.code,
        title: defectSeed.title,
        description: defectSeed.description,
        reproductionSteps: defectSeed.reproductionSteps,
        checklist: defectSeed.checklist,
        severity: defectSeed.severity,
        priority: defectSeed.priority,
        status: defectSeed.status,
        assigneeName: defectSeed.assigneeName,
        reporterName: defectSeed.reporterName,
        attachmentCount: defectSeed.attachmentCount,
      },
    });

    await prisma.defectLink.deleteMany({
      where: { defectId: defect.id },
    });

    const linkInputs = [
      ...defectSeed.testCaseCodes.map((code) => ({
        defectId: defect.id,
        testCaseId: testCaseByCode.get(code),
      })),
      ...defectSeed.resultCodes.map((code) => ({
        defectId: defect.id,
        testRunResultId: testRunResultByCode.get(code),
      })),
    ];

    for (const linkInput of linkInputs) {
      if ("testCaseId" in linkInput && !linkInput.testCaseId) {
        throw new Error(`Seed defect test case not found: ${defectSeed.code}`);
      }

      if ("testRunResultId" in linkInput && !linkInput.testRunResultId) {
        throw new Error(`Seed defect run result not found: ${defectSeed.code}`);
      }
    }

    await prisma.defectLink.createMany({
      data: linkInputs.map((linkInput) => ({
        defectId: linkInput.defectId,
        testCaseId: "testCaseId" in linkInput ? linkInput.testCaseId : undefined,
        testRunResultId: "testRunResultId" in linkInput ? linkInput.testRunResultId : undefined,
      })),
    });
  }

  const runResults = await prisma.testRunResult.findMany({
    where: {
      run: {
        projectId: demoProject.id,
        deletedAt: null,
      },
    },
    select: { id: true },
  });

  for (const result of runResults) {
    const defectCount = await prisma.defectLink.count({
      where: {
        testRunResultId: result.id,
        defect: {
          deletedAt: null,
        },
      },
    });

    await prisma.testRunResult.update({
      where: { id: result.id },
      data: { defectCount },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

function createTestCaseSeed(
  code: string,
  title: string,
  priority: "HIGH" | "MEDIUM" | "LOW",
  status: "READY" | "DRAFT" | "DEPRECATED",
  folderSlug: string,
  tags: string[],
  authorName: string,
  description: string,
  preconditions: string,
  steps: string[],
  expectedResult: string,
) {
  return {
    code,
    title,
    priority,
    status,
    folderSlug,
    tags,
    authorName,
    description,
    preconditions,
    steps,
    expectedResult,
  };
}

function createRunSeed(
  slug: string,
  title: string,
  description: string,
  assigneeName: string,
  environment: string,
  startDate: string,
  dueDate: string,
  status: "PLANNED" | "IN_PROGRESS" | "PAUSED" | "COMPLETED",
  results: Array<[
    string,
    "PENDING" | "PASSED" | "FAILED" | "BLOCKED" | "SKIPPED",
  ]>,
) {
  return {
    slug,
    title,
    description,
    assigneeName,
    environment,
    startDate,
    dueDate,
    status,
    results,
  };
}

function createDefectSeed(
  code: string,
  title: string,
  description: string,
  reproductionSteps: string,
  checklist: string[],
  severity: "CRITICAL" | "MAJOR" | "MINOR" | "TRIVIAL",
  priority: "HIGH" | "MEDIUM" | "LOW",
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED",
  assigneeName: string,
  reporterName: string,
  testCaseCodes: string[],
  resultCodes: string[],
  attachmentCount: number,
) {
  return {
    code,
    title,
    description,
    reproductionSteps,
    checklist,
    severity,
    priority,
    status,
    assigneeName,
    reporterName,
    testCaseCodes,
    resultCodes,
    attachmentCount,
  };
}

function toUtcDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}
