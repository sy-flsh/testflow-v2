const mockProjectNames: Record<string, string> = {
  "demo-project": "결제 시스템 v2",
  "signup-flow": "회원가입 플로우",
  "checkout-improvement": "체크아웃 개선",
  "mobile-app-v3": "모바일 앱 v3",
  "admin-console": "관리자 페이지",
  "notification-system": "알림 시스템",
  "api-v2-migration": "API v2 마이그레이션",
  "search-rebuild": "검색 기능 개편",
  "dark-mode": "다크모드 도입",
};

const mockProjectDescriptions: Record<string, string> = {
  "demo-project": "테스트케이스, 실행 결과, 결함을 연결할 데모 프로젝트입니다.",
  "signup-flow": "회원가입 주요 플로우를 검증하는 프로젝트입니다.",
  "checkout-improvement": "체크아웃 개선 범위의 테스트 활동을 관리합니다.",
  "mobile-app-v3": "iOS/Android 앱 v3 테스트를 추적합니다.",
  "admin-console": "관리자 페이지 개편 검증을 위한 프로젝트입니다.",
  "notification-system": "Push/SMS 알림 통합 테스트 프로젝트입니다.",
  "api-v2-migration": "API v2 전환 과정의 회귀 테스트를 관리합니다.",
  "search-rebuild": "검색 기능 개편 품질 상태를 추적합니다.",
  "dark-mode": "다크모드 도입 범위의 테스트 프로젝트입니다.",
};

export function getProjectName(projectId?: string) {
  if (!projectId) {
    return "프로젝트";
  }

  if (mockProjectNames[projectId]) {
    return mockProjectNames[projectId];
  }

  try {
    return decodeURIComponent(projectId).replace(/[-_]+/g, " ") || "프로젝트";
  } catch {
    return projectId || "프로젝트";
  }
}

export function getProjectDescription(projectId?: string) {
  if (!projectId) {
    return "프로젝트 컨텍스트를 선택하면 테스트 자산을 확인할 수 있습니다.";
  }

  return (
    mockProjectDescriptions[projectId] ??
    "아직 DB에 연결되지 않은 mock 프로젝트입니다. 화면 구조와 UX 흐름을 확인할 수 있습니다."
  );
}

export function getProjectIdFromPathname(pathname: string) {
  const match = pathname.match(/^\/projects\/([^/]+)(?:\/|$)/);
  return match?.[1];
}
