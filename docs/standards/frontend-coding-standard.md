# TMS 프론트엔드 코딩 표준 정의서 (Frontend Coding Standard)

| 항목 | 내용 |
| --- | --- |
| 문서명 | TMS 프론트엔드 코딩 표준 정의서 (Frontend Coding Standard) |
| 문서 버전 | v1.2 |
| 최초 작성일 | 2026-06-02 |
| 최종 개정일 | 2026-06-03 |
| 작성 주체 | Frontend 개발 에이전트 |
| 문서 등급 | L1 (영역별 세부 표준) |
| 상위 문서 | `docs/standards/development-standard.md` (L0, PM 작성) |
| 적용 범위 | `/frontend` 애플리케이션 전반 |

> 본 문서는 PM이 작성한 **개발 표준 정의서(L0)**의 상위 원칙을 프론트엔드 영역에 맞게 **구체화**한 L1 정의서입니다.
> L0와 충돌하는 내용이 있을 경우 L0가 우선하며, 본 문서를 갱신하여 정합성을 회복합니다. 모호하거나 충돌이 의심되는 사항은 임의 해석하지 않고 PM에게 명확화를 요청합니다.
> 각 절은 L0의 대응 절(3장 명명, 4장 구조, 7장 문서화, 8장 품질, 9장 보안/로깅/에러)을 근거로 구체화한 것입니다.

---

## 0. 가정한 기술 스택 (Assumed Tech Stack)

L0 문서는 프레임워크에 종속된 규칙을 다루지 않으며 기술 스택을 명시하지 않았습니다. 본 정의서는 업계에서 널리 쓰이는 다음 스택을 **합리적 기본값**으로 가정하여 구체 규칙을 작성합니다. 단, 명명/구조/계층 분리/보안 등 **원칙 자체는 다른 스택(Vue, Svelte 등)에도 응용 가능**하도록 작성합니다.

| 구분 | 가정 기술 | 비고 |
| --- | --- | --- |
| 언어 | TypeScript (strict 모드) | 타입 안전성 강제 |
| UI 라이브러리 | React 18+ (함수형 컴포넌트 + Hooks) | 클래스 컴포넌트 미사용 |
| 빌드 도구 | Vite | 번들러는 교체 가능 |
| 라우팅 | React Router | SPA 기준 |
| 서버 상태 | TanStack Query (React Query) | API 캐시/동기화 |
| 클라이언트 전역 상태 | Zustand (또는 Context API) | 경량 전역 상태 |
| HTTP 클라이언트 | Axios (인스턴스 기반) | fetch 래퍼로 대체 가능 |
| 스타일링 | CSS Modules + 디자인 토큰(CSS 변수) | 또는 동등한 스코프 스타일 방식 |
| 린터/포매터 | ESLint + Prettier | L0 8.2 정적 분석 강제 대상 |
| 정적 보안 분석(SAST) | **Sparrow** | JS/TS 소스 취약점·시큐어코딩 진단, CI 게이트(§9), High↑ 차단 |
| 테스트 | Vitest + React Testing Library | QA 정의서(`test-standard.md`)와 정합 |
| 패키지 매니저 | pnpm | 단일 매니저로 통일 |

> 실제 채택 스택이 위와 다를 경우, 본 문서의 "구체 규칙" 부분만 교체하고 "원칙" 부분은 유지합니다.

---

## 1. 명명 규칙 (Naming Convention)

> 근거: L0 3장(공통 명명 규칙 원칙). L0는 "의미 기반, 검색 가능성, 일관성, 발음 가능성, 부정 회피"의 상위 원칙을 제시하고 **구체 표기는 L1에 위임**했습니다. 본 절에서 표기를 확정합니다.

### 1.1 표기 케이스 확정표

| 대상 | 표기 케이스 | 예시 |
| --- | --- | --- |
| React 컴포넌트 | PascalCase | `DefectStatusBadge`, `UserAvatar` |
| 컴포넌트 파일 | PascalCase + `.tsx` | `DefectStatusBadge.tsx` |
| 커스텀 훅 | camelCase (`use` 접두어 필수) | `useTestCaseList`, `useAuth` |
| 일반 함수/메서드 | camelCase (동사로 시작) | `formatDate`, `fetchTestCases` |
| 변수 | camelCase | `testCaseList`, `selectedUserId` |
| 불리언 변수/prop | camelCase (`is/has/can/should` 접두어) | `isLoading`, `hasError`, `canEdit` |
| 상수 (모듈 레벨 불변값) | UPPER_SNAKE_CASE | `MAX_PAGE_SIZE`, `DEFAULT_TIMEOUT_MS` |
| 타입 / 인터페이스 | PascalCase (`I`/`T` 접두어 미사용) | `TestCase`, `Defect`, `ApiResponse` |
| 타입 별칭(유틸) | PascalCase | `DefectStatus`, `Nullable` |
| Enum / 유니온 멤버 | PascalCase 또는 UPPER_SNAKE | `DefectStatus.InProgress` |
| 제네릭 타입 파라미터 | 단일 대문자 또는 의미형 PascalCase | `T`, `TData`, `TError` |
| 이벤트 핸들러 (내부) | `handle` 접두어 | `handleSubmit`, `handleRowClick` |
| 이벤트 핸들러 prop | `on` 접두어 | `onSubmit`, `onSelect` |
| 비컴포넌트 TS 파일 | camelCase + `.ts` | `dateUtils.ts`, `testCaseApi.ts` |
| 폴더 | kebab-case | `test-case/`, `user-profile/` |
| 테스트 파일 | 원본명 + `.test.tsx`/`.test.ts` | `DefectStatusBadge.test.tsx` |
| 환경변수 | `VITE_` 접두어 + UPPER_SNAKE | `VITE_API_BASE_URL` |

### 1.2 식별자 약어 표기 확정

> L0 3.2는 "약어 대소문자 표기(`Id` vs `ID`)를 L1에서 택1"하도록 위임했습니다.

| 약어 | 확정 표기 | 예시 |
| --- | --- | --- |
| 식별자 | `Id` (마지막만 대문자) | `testCaseId`, `userId`, `defectId` |
| URL | `Url` | `imageUrl`, `redirectUrl` |
| API | `Api` (식별자), `API`(상수 prefix 불가) | `testCaseApi`, `useTestCaseApi` |
| HTTP | `Http` | `httpClient` |
| ID 복수 | `Ids` | `selectedTestCaseIds` |

- 표준 약어(`id`, `url`, `http`, `db`, `api`)만 허용합니다(L0 3.2).
- 임의 축약(`usr`, `cnt`, `btn` 변수명 등) 금지. 단 컴포넌트/CSS에서 통용되는 `Btn`은 금지하고 `Button`을 사용합니다.
- 도메인 고유 약어는 `docs/glossary.md` 등록 후 사용합니다(L0 3.3).

### 1.3 불리언 / 컬렉션 / 시간 / 식별자 (L0 3.4 구체화)

| 대상 | 규칙 | 예시 |
| --- | --- | --- |
| 불리언 | `is/has/can/should` 술어형 접두어 | `isOpen`, `hasPermission`, `canDelete` |
| 컬렉션 | 복수형 또는 `~List` | `testCases`, `testCaseList`, `selectedUserIds` |
| 시간 값 | 의미 + 단위 포함 | `createdAt`, `expiresInSeconds`, `timeoutMs` |
| 식별자 | `~Id` 접미어 | `testCaseId`, `parentTestCaseId` |
| 부정형 회피 | 이중 부정 금지 | `isVisible` (O) / `isNotHidden` (X) |

### 1.4 용어 일관성

도메인 용어는 L0 3.3의 공통 용어 사전(`docs/glossary.md`)을 따릅니다. 동일 개념은 컴포넌트명, prop명, API 함수명, 상태 키에서 **동일 영문 용어**로 표현합니다 (예: 테스트 케이스 → `TestCase`). 백엔드 API 경로/DTO 필드명과 프론트 모델명도 동일 용어를 공유합니다.

### 1.5 CSS 클래스 명명 — BEM (CSS Modules 기준)

> L0 3장 명명 원칙을 스타일 영역에 구체화. CSS Modules로 스코프가 보장되므로 BEM의 Block 충돌 위험은 낮으나, 가독성을 위해 BEM 구조를 채택합니다.

- 형식: `block__element--modifier`
- 클래스 자체는 camelCase 키로 접근(CSS Modules), 클래스명 문자열은 kebab/BEM 표기.

```css
/* TestCaseCard.module.css */
.testCaseCard { /* block */ }
.testCaseCard__title { /* element */ }
.testCaseCard__title--truncated { /* modifier */ }
.testCaseCard--selected { /* block modifier */ }
```

| 구성 | 의미 | 표기 |
| --- | --- | --- |
| Block | 독립 컴포넌트 단위 | `testCaseCard` |
| Element | Block 내부 구성 요소 (`__`) | `testCaseCard__title` |
| Modifier | 상태/변형 (`--`) | `testCaseCard--selected` |

---

## 2. 프로젝트 / 폴더 구조

> 근거: L0 4장(디렉터리/패키지 구조 원칙). 단방향 의존, 표현/도메인/인프라 분리, 도메인 응집, 폴더=책임 단위 원칙을 프론트에 구체화합니다.

### 2.1 최상위 구조

L0 4.1에 따라 프론트엔드 코드는 모노레포의 `/frontend` 하위에 위치합니다.

```
/frontend
├── public/                 # 정적 자산 (빌드 비가공)
├── src/
│   ├── app/                # 앱 진입/전역 설정 (라우터, 프로바이더, 전역 레이아웃)
│   ├── pages/              # 라우트 단위 페이지 (도메인 화면 조합)
│   ├── features/           # 도메인 기능 단위 (test-case, test-run, defect, auth ...)
│   ├── components/         # 공용 재사용 UI 컴포넌트 (도메인 비종속)
│   ├── hooks/              # 공용 커스텀 훅
│   ├── stores/             # 전역 클라이언트 상태 (Zustand 등)
│   ├── api/                # API 연동 계층 (클라이언트, 엔드포인트, 타입)
│   ├── lib/                # 외부 라이브러리 래퍼/설정
│   ├── utils/              # 순수 유틸 함수 (부수효과 없음)
│   ├── types/              # 전역 공용 타입
│   ├── styles/             # 디자인 토큰, 전역 스타일, 테마
│   └── constants/          # 전역 상수
├── tests/ (또는 코로케이션)  # QA 정의서 정합
├── .eslintrc.cjs
├── .prettierrc
├── tsconfig.json
└── README.md               # L0 7.2 README 기준 준수
```

### 2.2 feature(도메인) 폴더 내부 구조

L0 4.3 "도메인 응집" 원칙에 따라 기술 종류가 아닌 **도메인 단위**로 묶습니다. 각 feature는 자기 완결적 구조를 갖습니다.

```
src/features/test-case/
├── components/      # 해당 도메인 전용 컴포넌트
├── hooks/           # 해당 도메인 전용 훅 (useTestCaseList ...)
├── api/             # 해당 도메인 API 호출 (testCaseApi.ts)
├── stores/          # 해당 도메인 지역 전역 상태 (필요 시)
├── types/           # 해당 도메인 타입 (TestCase, TestStep ...)
├── utils/           # 해당 도메인 전용 유틸
└── index.ts         # 공개 인터페이스 (배럴) — 외부 노출 최소화
```

### 2.3 컴포넌트 분리 기준 (재사용 / 도메인)

| 구분 | 위치 | 기준 |
| --- | --- | --- |
| 공용(Presentational) 컴포넌트 | `src/components/` | 도메인 지식이 없고 어디서나 재사용. props만으로 동작 (`Button`, `Modal`, `Table`) |
| 도메인 컴포넌트 | `src/features/<도메인>/components/` | 특정 도메인 데이터/로직에 결합 (`DefectStatusBadge`) |
| 페이지 컴포넌트 | `src/pages/` | 라우트에 1:1 매핑, feature 컴포넌트를 조합. 비즈니스 로직은 훅에 위임 |

분리 휴리스틱:
- 한 컴포넌트 파일은 **단일 책임**을 갖는다(L0 4.3 폴더=책임 단위의 컴포넌트 적용).
- 200줄 또는 JSX 깊이가 과도하면 분리를 검토한다(L0 8.2 복잡도 기준).
- 동일 마크업/로직이 2회 이상 반복되면 공용 컴포넌트로 추출한다(L0 4.3 공통 코드 분리, 무분별 복제 금지).

### 2.4 의존 방향 규칙 (단방향, L0 4.2)

상위 → 하위 단방향 의존만 허용하고 **역방향/순환 의존을 금지**합니다.

```
pages → features → components / hooks / api / utils
features → components / hooks / api / utils
components → utils / types        (api, features 의존 금지)
utils → (외부 의존 없음, 순수)
```

| 규칙 | 내용 |
| --- | --- |
| 표현/도메인/인프라 분리 | `components`(표현) / `features`(도메인) / `api`(인프라) 계층 분리 |
| 공용→도메인 금지 | `components/`는 `features/`를 import 할 수 없다 |
| feature 간 직접 침투 금지 | 다른 feature 내부를 직접 import 금지, `index.ts` 공개 인터페이스로만 접근 |
| 순환 의존 금지 | ESLint `import/no-cycle` 룰로 강제 |

> 경로 별칭(`@/`)을 `tsconfig.json` + Vite에 설정하여 상대경로 지옥(`../../../`)을 방지합니다.

---

## 3. 코딩 스타일

> 근거: L0 8.2(정적 분석 — 린터/포매터 CI 강제). L0가 "들여쓰기 크기, 따옴표/세미콜론 등은 L1에서 정의"하라고 위임했습니다. 아래에서 Prettier/ESLint 기준으로 확정합니다.

### 3.1 포맷 규칙 (Prettier 기준 확정)

| 항목 | 규칙 |
| --- | --- |
| 들여쓰기 | 스페이스 2칸 (탭 미사용) |
| 최대 줄 길이 | 100자 (`printWidth: 100`) |
| 따옴표 | 작은따옴표(`'`) 기본, JSX 속성도 작은따옴표 |
| 세미콜론 | 항상 사용 (`semi: true`) |
| 후행 콤마 | `all` (다중 라인 시 항상) |
| 객체 중괄호 공백 | 사용 (`{ key: value }`) |
| 화살표 함수 괄호 | 항상 (`arrowParens: 'always'`) |
| 개행 문자 | LF (`endOfLine: 'lf'`) |
| 파일 끝 개행 | 1개 유지 |

```jsonc
// .prettierrc 예시 (확정값)
{
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": true,
  "jsxSingleQuote": true,
  "trailingComma": "all",
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### 3.2 TypeScript 규칙

| 항목 | 규칙 |
| --- | --- |
| strict 모드 | `tsconfig.json`에서 `"strict": true` 필수 |
| `any` 사용 | 금지(린트 에러). 불가피하면 `unknown` + 좁히기, 또는 주석으로 사유 명시 |
| 타입 단언(`as`) | 최소화. 타입 가드/제네릭 우선 |
| 함수 반환 타입 | 공개 함수/훅은 명시(자기 문서화), 내부 단순 함수는 추론 허용 |
| `interface` vs `type` | 객체 형태는 `interface`, 유니온/유틸리티는 `type` 권장 (영역 내 일관) |
| non-null 단언(`!`) | 지양. 명시적 분기 처리 우선 |
| enum | 가급적 유니온 리터럴(`'todo' | 'done'`) 또는 `as const` 사용 |

### 3.3 React 컴포넌트 작성 규칙

| 항목 | 규칙 |
| --- | --- |
| 컴포넌트 형태 | 함수형 컴포넌트 + Hooks만 사용 |
| props 타입 | 컴포넌트별 `Props` 인터페이스 명시 |
| 기본 export | 페이지는 default export, 그 외 공용 컴포넌트는 named export 권장(트리셰이킹/일관 import) |
| 1파일 1컴포넌트 | 공개 컴포넌트는 파일당 1개 (보조 소형 컴포넌트는 동일 파일 허용) |
| 인라인 화살표 핸들러 | 리스트 등 성능 민감 영역에서는 `useCallback`으로 추출 |
| 부수효과 | `useEffect`는 의존성 배열을 정확히 명시(ESLint `exhaustive-deps`) |
| 매직 넘버/문자열 | `constants`로 추출 |

```tsx
// 컴포넌트 작성 컨벤션 예시
interface TestCaseCardProps {
  testCase: TestCase;
  isSelected?: boolean;
  onSelect?: (testCaseId: string) => void;
}

export function TestCaseCard({ testCase, isSelected = false, onSelect }: TestCaseCardProps) {
  const handleClick = () => onSelect?.(testCase.id);

  return (
    <article
      className={clsx(styles.testCaseCard, isSelected && styles['testCaseCard--selected'])}
      onClick={handleClick}
    >
      <h3 className={styles.testCaseCard__title}>{testCase.title}</h3>
    </article>
  );
}
```

### 3.4 import 순서 규칙

ESLint `import/order`로 강제하며, 그룹 사이 빈 줄로 구분합니다.

1. 외부 라이브러리 (react, 서드파티)
2. 내부 절대경로 별칭 (`@/app`, `@/features`, `@/components`)
3. 상위/형제 상대경로 (`../`, `./`)
4. 스타일/자산 (`*.module.css`, 이미지)
5. 타입 전용 import (`import type ...`)는 각 그룹 내 분리 또는 별도 정렬

```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/Button';
import { testCaseApi } from '@/features/test-case/api/testCaseApi';

import { formatDate } from './utils';

import styles from './TestCaseCard.module.css';

import type { TestCase } from '@/features/test-case/types';
```

---

## 4. 상태 관리 규칙

> 근거: L0 4.2 계층 분리, 4.3 모듈화. 상태의 책임/소유를 명확히 분리합니다.

### 4.1 상태 분류 및 도구 매핑

| 상태 종류 | 정의 | 권장 도구 | 위치 |
| --- | --- | --- | --- |
| 지역(Local) 상태 | 한 컴포넌트 내부에서만 쓰는 UI 상태 | `useState`/`useReducer` | 컴포넌트 내부 |
| 공유 지역 상태 | 인접 컴포넌트 트리에서 공유 | 부모로 끌어올리기(lifting) / Context | feature 내부 |
| 서버 상태 | 서버가 원본인 데이터(목록/상세) | TanStack Query | `api`/`hooks` 계층 |
| 전역 클라이언트 상태 | 앱 전역 UI/세션 상태(테마, 인증 정보, 토스트) | Zustand store | `src/stores/` |
| URL 상태 | 필터/페이지/탭 등 공유·북마크 대상 | 라우터 쿼리스트링 | 라우팅 계층 |

### 4.2 전역 vs 지역 분리 기준 (핵심)

| 질문 | Yes → |
| --- | --- |
| 서버가 원본 데이터인가? | **서버 상태**(React Query). 전역 store에 복제하지 말 것 |
| 여러 무관한 화면에서 공유되나? | 전역 클라이언트 상태 |
| 새로고침/공유 시 보존돼야 하나? | URL 상태 또는 영속 store |
| 한 컴포넌트에서만 쓰나? | 지역 상태 |

원칙:
- **기본은 지역 상태**, 필요할 때만 위로 승격한다(불필요한 전역화 금지).
- **서버 상태와 클라이언트 상태를 혼동하지 않는다.** 서버 데이터는 React Query 캐시를 단일 출처(SSOT)로 삼고, 전역 store에 수동 복제하지 않는다.
- 전역 store는 **최소 표면적**으로 유지한다(L0 4.3 공개 인터페이스 최소화).
- 파생 값은 상태로 저장하지 말고 렌더 시 계산하거나 `useMemo`로 처리한다.

### 4.3 store 작성 규칙

| 규칙 | 내용 |
| --- | --- |
| 도메인별 분리 | 거대한 단일 store 금지, 도메인/관심사별 slice |
| 액션 캡슐화 | 상태 변경은 store 내 액션 함수로만 수행 |
| 직렬화 가능 | store에 함수/클래스 인스턴스 저장 지양 |
| 민감정보 | 토큰 등 민감정보는 store/로컬스토리지에 평문 저장 금지(9장 참조) |

---

## 5. API 연동 규칙

> 근거: L0 4.2(인프라 계층 분리), 9.3(에러 처리 공통 원칙), 9.1(보안). API 연동은 **전용 인프라 계층**으로 격리합니다.

### 5.1 호출 계층 구조

컴포넌트는 직접 HTTP를 호출하지 않습니다. 다음 단방향 계층을 따릅니다(L0 4.2 단방향 의존).

```
component → custom hook(useTestCaseList) → api function(testCaseApi.fetchTestCases)
          → http client(axios instance) → backend
```

| 계층 | 책임 | 위치 |
| --- | --- | --- |
| HTTP 클라이언트 | baseURL, 인터셉터, 공통 헤더, 타임아웃 | `src/api/httpClient.ts` |
| API 함수 | 엔드포인트별 요청/응답 타입 정의, 호출 | `features/<도메인>/api/*.ts` |
| 쿼리/뮤테이션 훅 | 캐싱, 로딩/에러 상태, 재시도 | `features/<도메인>/hooks/*.ts` |
| 컴포넌트 | 훅 결과 소비, 렌더링만 | `components`/`pages` |

```ts
// httpClient.ts — 단일 인스턴스
export const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: DEFAULT_TIMEOUT_MS,
});

// testCaseApi.ts — 엔드포인트 계층
export async function fetchTestCases(params: TestCaseListParams): Promise<TestCase[]> {
  const { data } = await httpClient.get<ApiResponse<TestCaseDto[]>>('/test-cases', { params });
  return data.data.map(toTestCase); // DTO → 도메인 모델 가공
}

// useTestCaseList.ts — 훅 계층
export function useTestCaseList(params: TestCaseListParams) {
  return useQuery({
    queryKey: ['testCases', params],
    queryFn: () => fetchTestCases(params),
  });
}
```

### 5.2 응답 데이터 가공 규칙

| 규칙 | 내용 |
| --- | --- |
| DTO ↔ 도메인 모델 분리 | 서버 응답 타입(`TestCaseDto`)과 화면 모델(`TestCase`)을 분리하고 매퍼(`toTestCase`)로 변환(L0 4.2 명시적 모델 전달) |
| 변환 위치 | 가공은 api 함수 계층에서 수행, 컴포넌트는 가공된 모델만 소비 |
| 날짜/숫자 포맷 | 표시용 포맷은 렌더 계층/`utils`에서, 원본 값은 모델에 보존 |
| 옵셔널 처리 | null/undefined를 매퍼에서 안전 기본값으로 정규화 |

### 5.3 공용 응답 래퍼 소비 (Backend §4.5 정합)

백엔드는 성공/실패가 **단일 공용 응답 래퍼**를 공유합니다(backend §4.5). 프론트는 이를 전제로 소비합니다.

```ts
// 공용 응답 래퍼 타입 (성공/에러 공유, 에러 시 진단 필드 추가)
interface ApiResponse<T> {
  success: boolean;
  code: string;        // 성공 'SUCCESS' / 에러 '{DOMAIN}_{상황}' (예: 'TESTCASE_NOT_FOUND')
  message: string;
  data: T | null;
  traceId?: string;    // 에러 시
  timestamp?: string;  // 에러 시
  path?: string;       // 에러 시
  errors?: { field: string; reason: string }[]; // 검증 실패 시
}
```

- 응답 인터셉터에서 `success === false`이면 `AppError`(code/message/traceId/fieldErrors)로 정규화하고, 성공은 `data`만 언래핑하여 반환합니다.
- 에러 코드는 **문자열 의미 코드**이므로(예: `TESTCASE_NOT_FOUND`), 코드→사용자 메시지 매핑 테이블의 키로 그대로 사용합니다.

### 5.4 에러 처리 (L0 9.3 구체화)

| 원칙 | 프론트 구체 규칙 |
| --- | --- |
| 명시적 처리 | silent catch 금지. 에러는 React Query `error` 상태로 노출하거나 명시적으로 처리 |
| 일관 응답 소비 | 공용 응답 래퍼의 `success=false`를 인터셉터에서 `AppError`로 통일(§5.3) |
| 내부 정보 비노출 | 스택트레이스/원시 응답을 화면에 직접 노출 금지 |
| 사용자 친화 메시지 | 에러 코드(`{DOMAIN}_{상황}`) → 사용자 메시지 매핑 테이블 사용, 미정의 코드는 일반 메시지로 폴백 |
| 실패 격리 | 컴포넌트 단위 Error Boundary로 부분 실패가 전체 화면을 무너뜨리지 않게 함 |
| 재시도/타임아웃 | 멱등 GET에 한해 제한적 재시도, 모든 요청에 타임아웃 설정 |
| 로딩/빈/에러 상태 | 모든 비동기 화면은 loading / empty / error 3상태를 반드시 처리 |

### 5.5 인증/헤더 처리

- 인증 토큰은 요청 인터셉터에서 **JWT Bearer**로 주입하고, 컴포넌트/API 함수에 토큰을 노출하지 않는다(backend §8.2).
- 401 응답은 인터셉터에서 일괄 처리(Refresh Token으로 갱신 또는 로그인 리다이렉트).
- 상관관계 ID(L0 9.2): 백엔드가 제공/요구하는 Correlation ID(`traceId`)를 요청 헤더로 전파하고, 에러 로그에 포함한다.
- **HTTP 메서드는 `GET`/`POST`만 사용**한다(backend §4.2). 조회는 GET, 생성·수정·삭제 등 상태 변경은 POST로 호출한다.
- **워크스페이스 컨텍스트**(L0 §9.1, backend §7.5): 현재 `workspaceId`는 인증 토큰/세션에서 확정하며, 화면/요청은 현재 워크스페이스 범위로만 동작한다. 워크스페이스 전환은 라우트/전역 상태로 관리하고, 서버가 인증 컨텍스트로 격리를 강제하므로 **클라이언트가 `workspaceId`를 임의로 위조·전달해 다른 워크스페이스 데이터를 요청하지 않는다.**

### 5.6 OpenAPI 기반 자동 생성 (필수 권장)

- **정본**: `docs/api/openapi.yaml` (PM P1 산출물). 손 작성 클라이언트 코드 금지.
- **타입 생성**: `openapi-typescript` 또는 동등 도구로 요청·응답·enum 타입 자동 생성. 생성 파일은 git에 커밋(빌드 시 재생성 가능하나 IDE/CI 일관성 위해 커밋).
- **클라이언트 생성**: `openapi-fetch` 또는 `orval` 등으로 API 함수·React Query 훅 자동 생성 검토. 자동 생성된 결과를 §5.1 계층 구조에 매핑.
- **drift 자동 검출**: BE가 `openapi.yaml` 변경 → FE 재생성 → 컴파일 에러로 drift 노출 → 수정. PR CI에 재생성 + diff 검증 게이트 추가.
- **수동 작성 허용 예외**: 자동 생성이 불가능한 다중 응답 분기·multipart·SSE 등은 §5.1 계층을 따라 손 작성.

### 5.8 metadata-service 코드 조회 (Soft Enum 통합)

**정본**: [`docs/integration/codes.md`](../integration/codes.md). 모든 도메인 상태/타입/우선순위는 외부 metadata-service에서 동적 조회.

| 항목 | 규칙 |
| --- | --- |
| 호출 경로 | FE는 BE 프록시 엔드포인트(`GET /api/codes/:groupKey`)만 사용. metadata-service 직접 호출·키 노출 금지 |
| 훅 | `useCodes(groupKey)` — React Query `queryKey: ['codes', groupKey, locale]`, `staleTime: 5분`, `cacheTime: 30분` |
| 표시 컴포넌트 | `<StatusBadge codeGroup="tms.defect_status" codeKey={value} />`, `<CodeSelect codeGroup="tms.priority" ... />` — codes.md §7.2 정본 |
| 라벨 | `code.labels.ko` / `code.labels.en` 우선, 없으면 i18n 키 `code.<groupKey>.<codeKey>` 폴백 |
| 색상 | `code.data.color` 메타에서 디자인 토큰 변수명 추출. 직접 색 하드코딩 금지 |
| 활성 필터 | 신규 입력 UI는 활성 코드만 (`activeOnly=true`). 기존 데이터 표시는 미사용 코드도 라벨 가져와 표시 (deprecated 표기) |
| 캐시 무효화 | metadata-service version INCR 감지 → React Query invalidate (BE webhook 또는 polling) |
| 장애 fallback | 캐시 만료 + 응답 5xx → stale cache 사용 (가용성 우선) |

### 5.7 금지 패턴

| 금지 | 사유 |
| --- | --- |
| 컴포넌트에서 `fetch`/`axios` 직접 호출 | 계층 우회. 인증·에러·로깅 일관성 깨짐. §5.1 위반 |
| feature/도메인별 별도 HTTP 인스턴스 생성 | 인터셉터 분기 폭발. 단일 `httpClient` 강제 |
| 에러 처리 컴포넌트마다 중복 작성 | §5.4 인터셉터·`AppError` 정규화로 통일 |
| `httpClient` 직접 import (Layer 2 우회) | API 함수 계층 경유 필수 |
| 응답 데이터 가공을 컴포넌트에서 수행 | §5.2 위반. API 함수에서 매퍼로 변환 |
| 인증 토큰을 컴포넌트/페이지 상태에 보관 | §5.5 위반. 인터셉터/저장소만 |

---

## 6. 스타일링 규칙

> 근거: L0 3장(명명), 4.3(공통 코드 분리). 스타일도 중복을 줄이고 토큰 기반 일관성을 유지합니다.

### 6.1 CSS 작성 방식

| 규칙 | 내용 |
| --- | --- |
| 스코프 방식 | CSS Modules(`*.module.css`)를 기본으로 컴포넌트 단위 스코프 |
| 전역 스타일 최소화 | 전역 CSS는 reset/토큰/타이포 등 최소한으로 한정(`src/styles/`) |
| 인라인 스타일 | 동적 계산 값 외 인라인 스타일 지양 |
| `!important` | 원칙적 금지(특이도 충돌은 구조로 해결) |
| 클래스 결합 | 조건부 클래스는 `clsx`/`classnames`로 명시적 결합 |
| 단위 | 폰트/간격은 `rem`, 1px 보더 등 물리 단위만 `px` |

### 6.2 디자인 토큰 / 테마 — 디자이너 정본 인용

**정본**: [`docs/design/00_design_system_v3.md`](../design/00_design_system_v3.md) — 디자이너 작성 디자인 시스템.
- §1 컬러 (Primitive 팔레트 + Semantic 토큰 + 도메인 상태 토큰)
- §2 타이포그래피 (Pretendard / Display·Text scale)
- §3 간격 (`--gap-xs/sm/md/lg`)
- §4 레이아웃 (브레이크포인트·앱 셸·Auth Layout)
- §5 컴포넌트 사이즈·State·Variant

본 §6.2는 디자이너 정본을 **인용**하며 토큰 값은 재정의 금지. 정의 변경은 디자이너 파일에서 수행 후 본 문서 정합 갱신.

#### 6.2.1 토큰 카테고리 (디자이너 §1·§2·§3 매핑)

| 카테고리 | 변수 명명 패턴 | 디자이너 §정본 | 비고 |
| --- | --- | --- | --- |
| Primitive 컬러 | `--brand-*`, `--neutral-*`, `--slate-*`, `--red-*`, `--green-*` 등 | §1 Primitive 팔레트 | 직접 사용 지양 — semantic 우선 |
| Semantic 컬러 | `--bg-*`, `--border-*`, `--text-*`, `--feedback-*` | §1 Semantic 토큰 | 컴포넌트는 semantic만 사용 |
| 도메인 상태 컬러 | `--status-*`, `--severity-*`, `--defect-*`, `--invite-*` | §1 도메인 상태 토큰 | metadata-service Code.data.color 정합 (codes.md §3) |
| 타이포 | `--font-sans`, `--font-mono`, `--text-display-*`, `--text-xs~xl` | §2 타이포그래피 | 직접 폰트 패밀리/사이즈 하드코딩 금지 |
| 간격 | `--gap-xs/sm/md/lg` | §3 간격 | `--space-*` 별칭 사용 시 디자이너 토큰으로 매핑 |
| 컴포넌트 사이즈 | sm/md/lg/xl height·padding·radius | §5 공통 사이즈 토큰 | Button/Input/Select 공통 |
| z-index | `--z-modal`(200) / `--z-drawer`(150) / `--z-toast`(300) / `--z-popover`(60) | §5 Modal·Drawer·Toast | 본 절 §6.2.2 표 참조 |
| Breakpoint | `768px` (tablet) / `1024px` (desktop) | §4 브레이크포인트 | mobile <768 활성 (락 v2.4) |

#### 6.2.2 z-index 스케일 (정본)

| 토큰 | 값 | 용도 |
| --- | --- | --- |
| `--z-app-shell` | 100 | Sidebar / Header |
| `--z-drawer` | 150 | 사이드바(Drawer) |
| `--z-modal` | 200 | 모달 / 다이얼로그 |
| `--z-toast` | 300 | Toast / Notification |
| `--z-popover` | 60 | Popover / Tooltip / Select dropdown |
| `--z-overlay-on-modal` | 250 | 모달 위 다이얼로그 (§12.4 z-index 1단 위 룰) |

| 규칙 | 내용 |
| --- | --- |
| 토큰 우선 | 색상/간격/타이포/반경/그림자/z-index는 토큰 변수만 사용 |
| 테마 전환 | `data-theme` 속성 기반으로 토큰 값만 교체(컴포넌트 코드 불변) |
| 토큰 명명 | 디자이너 §1·2·3 명명 그대로 사용 (`--bg-base`, `--text-primary`, `--gap-md`) |
| 매직 값 금지 | 디자이너 정본에 없는 신규 값은 디자이너 정본 갱신 후 사용 |
| 도메인 상태 색 | 직접 토큰 참조 X — metadata-service `Code.data.color` 경유 (codes.md §3) |

---

## 7. 접근성 / 반응형 기준

> 근거: L0 8장(품질 기준)을 사용자 접근성·디바이스 대응 품질로 확장합니다.

### 7.1 접근성 (Accessibility, a11y)

목표 수준: **WCAG 2.1 AA** 준수.

| 항목 | 기준 |
| --- | --- |
| 시맨틱 마크업 | `div` 남용 금지, `button`/`nav`/`main`/`header` 등 의미 태그 사용 |
| 키보드 접근 | 모든 인터랙티브 요소는 키보드로 조작 가능(포커스 이동/Enter/Space) |
| 포커스 표시 | 포커스 링 제거 금지, 가시적 포커스 스타일 제공 |
| 대체 텍스트 | 의미 있는 이미지에 `alt`, 장식 이미지는 `alt=""` |
| 폼 라벨 | 모든 입력에 `label`(또는 `aria-label`) 연결 |
| ARIA | 네이티브 요소 우선, 부족할 때만 ARIA 보조(`aria-*`, `role`) |
| 색 대비 | 본문 텍스트 대비 4.5:1 이상 |
| 색 의존 금지 | 색만으로 정보 전달 금지(아이콘/텍스트 병행) |
| 동적 알림 | 비동기 결과/에러는 `aria-live`로 스크린리더에 전달 |
| 린트 강제 | `eslint-plugin-jsx-a11y`를 CI에서 강제(L0 8.2) |

### 7.2 반응형 (Responsive)

**정본**: [`docs/design/00_design_system_v3.md`](../design/00_design_system_v3.md) §4 브레이크포인트 — 컬럼·거터·패딩·CSS 미디어쿼리. 본 §7.2는 코드 측 보강 룰만 정의(중복 표 제거).

| 규칙 | 내용 |
| --- | --- |
| 모바일 퍼스트 | 기본 스타일은 모바일, `min-width`로 점진 확장 |
| 유연 레이아웃 | 고정 px 폭 지양, Flex/Grid + 상대 단위 |
| 터치 타깃 | 인터랙티브 요소 최소 44x44px |
| 가로 스크롤 금지 | 의도치 않은 가로 오버플로 발생 금지 |
| 이미지 대응 | 반응형 이미지(`srcset`)/지연 로딩 적용 |
| mobile 사이드바 | 햄버거 트리거 + drawer (좌측 슬라이드인). 햄버거 우측에 핵심 액션 노출 |
| mobile 모달 | full-screen sheet (하단→상단 슬라이드). Esc 키 → 뒤로가기 매핑 |
| mobile 테이블 | 카드 뷰 전환. 핵심 컬럼만 노출, 나머지는 expand |

---

## 8. 문서화 / 주석 (L0 7장 구체화)

| 항목 | 프론트 구체 규칙 |
| --- | --- |
| README | `/frontend/README.md`에 개요/요구환경(Node 버전 등)/설치·실행/디렉터리 구조/기여 방법 포함(L0 7.2) |
| 공개 컴포넌트 문서 | export 컴포넌트/훅은 JSDoc(`@param`, `@returns`)로 시그니처 수준 문서화(L0 7.3) |
| Why 중심 주석 | 비자명한 로직(성능 우회, 브라우저 호환 처리)에 "왜"를 주석으로 남김 |
| 자기 문서화 우선 | 명확한 명명/타입으로 주석 필요성 최소화 |
| TODO/FIXME | 담당자·이슈 참조 포함(`// TODO(TMS-123): ...`) |
| 죽은 주석 금지 | 주석 처리된 코드 커밋 금지 |
| Storybook(권장) | 공용 컴포넌트는 스토리로 사용례/상태 문서화 |

---

## 9. 품질 / 정적 분석 (L0 8장 구체화)

| 항목 | 프론트 구체 규칙 |
| --- | --- |
| 커버리지 목표 | 상태/유틸 등 로직 70% 이상, 신규/변경 코드 80% 이상(L0 8.1). 순수 UI 마크업은 예외 가능 |
| 린터/포매터 | ESLint + Prettier를 CI에서 강제, 위반 시 머지 차단(L0 8.2) |
| 타입 검사 | `tsc --noEmit`을 CI 필수 통과 게이트로 포함 |
| 빌드 경고 | 신규 경고 0건(L0 8.2), 가능하면 warnings-as-errors |
| SAST(Sparrow) | Sparrow로 JS/TS 소스 보안 진단을 CI에 포함, High↑ 머지 차단 |
| 취약점 스캔 | 의존성 스캔 CI 포함, High 이상 머지 차단(L0 8.2) |
| 복잡도/중복 | 과도한 컴포넌트 길이/중첩/중복은 리뷰에서 분할·추출 요구(L0 8.2) |
| 번들 예산 | 주요 청크 크기 예산을 정하고 초과 시 코드 스플리팅 검토 |

### 9.1 권장 ESLint 핵심 룰셋

| 룰 | 목적 |
| --- | --- |
| `@typescript-eslint/no-explicit-any` | `any` 금지 |
| `react-hooks/rules-of-hooks`, `exhaustive-deps` | 훅 규칙/의존성 |
| `import/order`, `import/no-cycle` | import 순서·순환 의존 방지 |
| `jsx-a11y/*` | 접근성 강제 |
| `no-console` (warn 제외 제한) | 로깅 정책 준수(9장) |
| `no-alert` | `alert/confirm/prompt` 사용 차단 (§12 커스텀 다이얼로그 강제) |
| `no-restricted-globals` (`alert`, `confirm`, `prompt`) | 전역 함수 호출 차단 (§12) |

---

## 10. 보안 / 로깅 / 에러 (L0 9장 클라이언트 구체화)

> L0 10장 매핑표에 따라 프론트는 9장의 "클라이언트 측 구체 규칙"을 담당합니다.

### 10.1 보안 (L0 9.1)

| 원칙 | 프론트 구체 규칙 |
| --- | --- |
| 입력 검증 | 클라이언트 검증은 UX 보조일 뿐, **서버 검증을 대체하지 않음**(서버 검증 필수 전제) |
| XSS 방지 | `dangerouslySetInnerHTML` 금지(불가피 시 sanitize 라이브러리 필수) |
| 시크릿 비저장 | API 키/비밀을 번들/리포지토리에 포함 금지. 공개 환경변수(`VITE_*`)는 비밀이 아님을 전제 |
| 토큰 저장 | 인증 토큰은 가능하면 HttpOnly 쿠키. localStorage 평문 저장 지양 |
| 민감정보 마스킹 | 화면/로그에 개인정보·인증정보 마스킹(L0 9.1) |
| 방어적 기본값 | 권한 미확인 시 기본 비노출(deny by default), 라우트 가드로 보호 |
| 의존성 관리 | 정기 취약점 점검·갱신 |
| 외부 링크 | `target="_blank"`에 `rel="noopener noreferrer"` |

### 10.2 로깅 (L0 9.2)

| 원칙 | 프론트 구체 규칙 |
| --- | --- |
| 직접 console 지양 | 운영 빌드에서 `console.log` 제거, 중앙 logger 유틸 사용 |
| 로그 레벨 | `error/warn/info/debug` 의미에 맞게(L0 9.2). debug는 운영 비활성 |
| 민감정보 제외 | 토큰/개인정보 로그 기록 금지 |
| 상관관계 ID | 에러 리포팅에 백엔드 Correlation ID 포함(전 구간 추적) |
| 에러 수집 | 미처리 예외/Promise rejection을 전역 핸들러+모니터링 도구로 수집 |
| 과도 로깅 금지 | 의미 있는 이벤트 중심 기록 |

### 10.3 에러 처리 (L0 9.3)

§5.4와 동일 원칙. 추가로 앱 루트에 **전역 Error Boundary**와 전역 비동기 에러 핸들러를 두어 화이트스크린을 방지하고 사용자에게 안전한 폴백 UI를 제공합니다.

---

## 11. 버전 관리 / 리뷰 (L0 5·6장 준수)

L0 5장(브랜치/커밋/버전)과 6장(PR/리뷰/머지)을 **그대로 준수**합니다. 프론트 추가 사항:

| 항목 | 내용 |
| --- | --- |
| 커밋 scope | 프론트 변경은 `feat(frontend): ...` 형태로 scope에 `frontend` 또는 도메인 명시(L0 5.2) |
| PR 스크린샷 | UI 변경 PR은 변경 전/후 스크린샷 또는 영상 첨부(L0 6.1) |
| 셀프 리뷰 | 접근성·반응형·로딩/에러 3상태 처리 여부를 작성자가 사전 점검 |
| CI 통과 | 타입체크/린트/테스트/빌드 모두 통과해야 리뷰 요청(L0 6.1, 8.3) |

---

## 12. 브라우저 네이티브 다이얼로그 금지 — 커스텀 공통 컴포넌트 강제

> 근거: L0 7장(UX 일관성), §6.2(디자인 토큰), §7.1(접근성), §9(품질·정적 분석). 브라우저 기본 `window.alert/confirm/prompt`는 디자인 토큰·i18n·접근성 정합 불가, 모달 1개 룰(§8 UI 표현 패턴) 회피 — 사용 금지.

### 12.1 금지 대상

| 대상 | 사용 | 대체 |
| --- | --- | --- |
| `window.alert()` | 금지 | `AlertDialog` |
| `window.confirm()` | 금지 | `ConfirmDialog` / `DestructiveConfirmDialog` |
| `window.prompt()` | 금지 | 모달 폼 또는 인라인 폼 |
| `beforeunload` 단독 | 금지 | 라우터 가드 + `ConfirmDialog` (+ `beforeunload` 폴백 병행 허용) |

### 12.2 공통 컴포넌트 카탈로그

| 컴포넌트 | 용도 | 패턴 | 위치 |
| --- | --- | --- | --- |
| `AlertDialog` | 정보 안내·결과 통지 | 모달, 1버튼(확인), 비파괴 | `src/components/dialog/AlertDialog/` |
| `ConfirmDialog` | 진행/취소 양자 선택 | 모달, 2버튼, 비파괴 | `src/components/dialog/ConfirmDialog/` |
| `DestructiveConfirmDialog` | 파괴적 액션(삭제·비활성·소유자 이관) | 모달, 빨강 confirm variant, 기본 포커스 취소, 옵션 타이핑 확인 | `src/components/dialog/DestructiveConfirmDialog/` |
| `Toast` / `Notification` | 비차단 알림(성공·실패·정보) | 자동 dismiss + 수동 닫기 | `src/components/feedback/Toast/` |
| `InlineBanner` | 페이지/섹션 상단 영구 표시 | 권한 부족·작업 진행 중 등 | `src/components/feedback/InlineBanner/` |

### 12.3 사용 패턴 — 공통 훅 경유 (필수)

- 호출은 훅 경유: `useAlert()`, `useConfirm()`, `useToast()`. 컴포넌트 트리에 dialog 직접 마운트 금지.
- 반환은 `Promise<boolean>` 또는 결과 객체. 동기 차단(`window.confirm` 흉내) 금지 — async/await만.
- `<DialogProvider/>`, `<ToastProvider/>`를 앱 루트 1회 마운트. 다중 동시 호출은 큐잉.

```ts
const ok = await confirm({
  title: t('project.delete.title'),
  message: t('project.delete.message', { name }),
  danger: true,
  confirmLabel: t('common.delete'),
  cancelLabel: t('common.cancel'),
  requireType: name, // 타이핑 확인 (옵션)
});
if (!ok) return;
await projectService.delete(id);
toast.success(t('project.delete.success'));
```

### 12.4 표현 룰

| 항목 | 룰 |
| --- | --- |
| 모달 동시 열림 | §8 모달 1개 룰 적용. 다이얼로그 호출 시 기존 모달 닫지 않고 z-index 1단계 위에 띄움(스택 1단까지만 허용) |
| 백드롭 | AlertDialog/ConfirmDialog는 dim O. 사이드바·상위 모달 컨텍스트는 유지 |
| 기본 포커스 | 파괴적 다이얼로그는 **취소** 버튼 기본 포커스. Enter 즉시 확정 방지 |
| Toast 위치 | 우상단 스택. 최대 5개 동시. 초과 시 큐잉 |
| 키보드 | `Esc` 닫기, `Tab` 포커스 트랩, Enter 확정(파괴적은 위 룰 적용) |
| i18n | 메시지는 i18n 키만 사용. raw 한글 하드코딩 금지 |
| 접근성 (a11y) | `role="alertdialog"`(파괴적) / `role="dialog"`(일반), `aria-labelledby`·`aria-describedby` 의무. Toast는 `role="status"`(정보) / `role="alert"`(에러) |

### 12.5 금지/허용 매트릭스

| 케이스 | 금지 | 허용 |
| --- | --- | --- |
| "정말 삭제?" 확인 | `window.confirm` | `DestructiveConfirmDialog` |
| 저장 완료 통지 | `alert('저장됨')` | `Toast` (`useToast.success`) |
| 입력값 요청 | `window.prompt` | 모달 폼 / 인라인 폼 |
| 페이지 이탈 시 미저장 경고 | `beforeunload` 단독 | 라우터 가드 + `ConfirmDialog` (+ `beforeunload` 폴백) |
| 검증 에러 표시 | `alert(에러)` | 폼 필드 inline error + 서버 에러 시 `Toast` |
| 권한 부족 안내 | `alert` | `InlineBanner` 또는 403 페이지 |

### 12.6 정적 분석 강제 (§9.1 보강)

ESLint 규칙을 §9.1 룰셋에 추가:

| 룰 | 설정 | 목적 |
| --- | --- | --- |
| `no-alert` | `error` | `alert/confirm/prompt` 사용 차단 |
| `no-restricted-globals` | `error` (`alert`, `confirm`, `prompt`) | 전역 함수 호출 차단 |
| `no-restricted-syntax` (선택) | `error` (`CallExpression[callee.object.name='window'][callee.property.name=/^(alert\|confirm\|prompt)$/]`) | `window.alert` 형태 차단 |

위반 시 CI 머지 차단(L0 8.2).

### 12.7 폼 유효성 메시지 i18n 정합

**정본**: [`docs/design/00_design_system_v3.md`](../design/00_design_system_v3.md) §6 — 디자이너 소유. raw 문구 단일 진실 원.

| 규칙 | 내용 |
| --- | --- |
| raw 문구 소유 | 디자이너 §6 표만. 본 문서·컴포넌트 코드·컴포넌트 명세(`docs/design/components/*`)·Toast·다이얼로그 등 외부에서는 i18n 키만 참조 |
| i18n 키 패턴 | `validation.<field>.<rule>` / `success.<field>.<rule>` (예: `validation.email.required`, `validation.password.format`) |
| 코드 호출 | `t('validation.email.required')`. 키 직접 작성 X — 상수 또는 타입 가드 사용 권장 |
| locale JSON 동기화 | `locales/ko.json` / `locales/en.json` 은 디자이너 §6 표에서 자동 추출(`scripts/sync-i18n-from-design.ts`). 수동 편집 금지 |
| CI 게이트 | 디자이너 §6 ↔ locale JSON drift 0건 검증. 코드 내 raw 문구 정규식 차단(아래 §12.8) |
| 컴포넌트 명세 (Tier 2) | `docs/design/components/<comp>.md` State 매트릭스의 메시지 컬럼은 **i18n 키만** 기재. raw 문구 중복 X |
| BE ErrorCode 매핑 | `backend-coding-standard §5.2` ErrorCode → i18n 키 매핑 표는 컴포넌트 명세 또는 `docs/integration/error-code-mapping.md`(별도) — 서버 검증 에러를 동일 i18n 키로 표시 |
| 신규 메시지 추가 | 디자이너 §6 PR → locale JSON 재추출 → BE ErrorCode 매핑 갱신 (필요 시) → 컴포넌트 명세 트리거 행 추가. 4단계 한 PR 권장 |
| 변경 절차 | 디자이너 §6 1곳만 변경. 코드·명세·locale 자동 전파 |

### 12.8 raw 문구 하드코딩 차단 (정적 분석)

§9.1 ESLint 룰셋에 추가 권장:

| 룰 | 설정 | 목적 |
| --- | --- | --- |
| `i18next/no-literal-string` (또는 `eslint-plugin-jsx-no-literals`) | `error` (JSX 텍스트·string prop 한정) | 사용자 노출 raw 문구 차단 → `t()` 강제 |
| 화이트리스트 | 디자인 토큰명·코드값·디버그 라벨 등 | `markup`/`testId`/`data-*` 제외 |

추가 CI 검증: 디자이너 §6 표 → 키 목록 추출 → 코드 내 `t('...')` 호출 키와 unused/missing 검증 (선택, 정밀도 ↑).

---

## 부록 A. L0 ↔ L1 정합성 매핑

| L0 절 | 본 문서 대응 절 | 구체화 내용 |
| --- | --- | --- |
| 3. 명명 규칙 원칙 | 1 | 컴포넌트/파일/CSS 표기, `Id` 표기 확정 |
| 4. 구조 원칙 | 2 | 폴더/feature 구조, 단방향 의존, 컴포넌트 분리 |
| (위임: 들여쓰기/따옴표/세미콜론) | 3 | Prettier/ESLint 값 확정 |
| 4. 구조 원칙 | 4 | 상태 분리 기준 |
| 4.2 / 9.3 | 5 | API 계층/에러 처리 |
| 3 / 4.3 | 6 | 스타일링/디자인 토큰 |
| 8 | 7 | 접근성/반응형 품질 |
| 7. 문서화 | 8 | 컴포넌트 문서/주석 |
| 8. 품질 | 9 | 커버리지/정적분석 |
| 9. 보안/로깅/에러 | 10 | 클라이언트 측 구체 규칙 |
| 5·6. 버전/리뷰 | 11 | 그대로 준수 + 프론트 추가 |

## 부록 B. 문서 변경 이력

| 버전 | 일자 | 변경 내용 | 작성자 |
| --- | --- | --- | --- |
| v1.0 | 2026-06-02 | 최초 작성 (L0 v1.0 기반 구체화) | Frontend 에이전트 |
| v1.1 | 2026-06-03 | 이전(legacy) 개발 표준 정의서 통합 정렬. ① §5.3 **공용 응답 래퍼 `ApiResponse`(성공/실패 공유 + 에러 진단 필드) 소비** 규칙 추가, 에러 코드를 **문자열 의미 코드**(`{DOMAIN}_{상황}`)로 소비. ② §5.4 에러 처리 정합, §5.5 인증을 JWT Bearer/Refresh로 구체화하고 **HTTP 메서드 GET/POST 전용** 명시. ③ 전 예시를 **glossary 정본 용어로 정렬**(`Task`/`TaskAssignment`→`TestCase`/`Defect`, `useTaskList`→`useTestCaseList`, `taskApi`→`testCaseApi`, `TaskCard`→`TestCaseCard`, `TaskStatus`→`DefectStatus`, 폴더 `task`→`test-case`, BEM `.taskCard`→`.testCaseCard` 등). (backend §4.5/§5.2/§8.2 정합) | Frontend 에이전트 |
| v1.2 | 2026-06-03 | **워크스페이스 격리 + SAST(Sparrow)** 반영. ① §0 스택에 Sparrow(SAST) 추가, §9 품질에 SAST 게이트(High↑ 차단) 추가. ② §5.5에 워크스페이스 컨텍스트 전파 원칙(서버가 인증 컨텍스트로 격리 강제, 클라이언트 `workspaceId` 위조 금지) 추가. (glossary `Workspace`, L0 §9.1, backend §7.5 정합) | Frontend 에이전트 |
