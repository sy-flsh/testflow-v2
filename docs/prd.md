# PRD: TestFlow v2

## 1. 제품 개요

TestFlow v2는 QA, 개발, PM이 함께 쓰는 한국형 테스트 관리 SaaS다. 테스트케이스를 작성하고, 실행 결과를 기록하고, 실패 또는 차단된 결과를 결함과 연결해 기본 보고까지 이어지는 실사용형 QA 관리 흐름을 제공한다.

v0.1의 핵심 목표는 다음 흐름을 완성하는 것이다.

1. 프로젝트를 만든다.
2. 테스트케이스를 직접 작성하거나 CSV로 가져온다.
3. 테스트 실행을 만들고 실행 대상 테스트케이스를 선택한다.
4. 각 테스트케이스에 Pass / Fail / Block / Skip 결과를 저장한다.
5. failed / blocked 결과에서 결함을 생성하고 연결한다.
6. 대시보드와 보고서에서 기본 품질 현황을 확인한다.

제품 UX는 `tms_mds_v0.1` 화면 요청서의 정제된 미니멀 SaaS 디자인을 기준으로 한다. 기능과 저장 정책은 기존 `project_0429_prd.md`에서 실제 구현 및 검증된 Test Case, Test Run, Test Run Result, Defect, CSV Import, AI Draft, localStorage fallback 정책만 선별해 반영한다.

현재 v0.1 구현 기준은 Next.js App Router, Prisma, PostgreSQL API를 source of truth로 사용하는 DB/API 기반 QA 관리 흐름이다. mock 데이터는 seed, 빈 상태 보조, API 실패 시 legacy fallback 용도로만 남긴다.

## 2. v0.1 MVP 범위

v0.1에 포함하는 기능은 아래로 한정한다.

### 인증

- custom credentials 기반 로그인/회원가입
- DB-backed opaque session cookie
- `tf_session` HttpOnly cookie
- DB에는 session token 원문이 아닌 `tokenHash`만 저장
- 세션 만료 14일
- 로그인 성공 후 safe `next` redirect
- middleware 기반 앱 내부 페이지 보호
- unsafe API Origin/Referer 기반 CSRF guard
- login/signup DB 기반 rate limit
- `/api/auth/me` 기반 current user/current workspace 조회
- AuthProvider 기반 current auth state 중앙화
- 실제 운영 수준 이메일 인증, 비밀번호 재설정은 후속 Phase

### 대시보드

- DB 집계 API 기반 전체 프로젝트 수
- DB 집계 API 기반 전체 테스트케이스 수
- 진행 중 테스트 수
- 전체 테스트 실행 수
- 발견 결함 수
- 최근 실행 결과 요약 차트
- 진행 중 프로젝트 요약
- 최근 활동 요약

### 프로젝트

- Project DB/API 기반 목록 조회
- Project 생성
- Project 상세 조회
- Project 수정
- Project 삭제
- 프로젝트 카드 UI
- 프로젝트 선택 후 테스트케이스 탭 진입

### 테스트케이스

- TestFolder / TestCase / TestStep DB/API 기반 저장
- Folder Tree
- TC Table
- Test Case CRUD
- TC 상세/편집 Drawer
- CSV Import preview / commit
- XLSX 템플릿 다운로드
- Drawer 기반 Quick Edit
- Bulk Edit
- AI 테스트케이스 초안 생성 및 선택 저장

### AI 테스트케이스 초안

- 기능명, 요구사항, 대상 폴더, 우선순위, 생성 개수, 테스트 유형 기반 초안 생성
- 생성 결과는 바로 저장하지 않고 사용자 검토 후 선택 저장
- OpenAI 호환 API 호출 실패, API key 없음, JSON 파싱 실패 시 rule-based fallback
- fallback 발생 시 사용자에게 안내

### 테스트 실행

- TestRun / TestRunResult DB/API 기반 저장
- Test Run 목록
- Test Run 생성
- 실행 대상 Test Case 선택
- 선택한 Test Case 기준 TestRunResult 자동 생성
- Result 상태 저장: pending, passed, failed, blocked, skipped
- Runner 화면 또는 Drawer
- 결과 저장 후 다음 TC로 이동

### 결함

- Defect / DefectLink DB/API 기반 저장
- Defect CRUD
- failed / blocked Result에서 Defect 생성
- Defect와 TestCase 연결
- Defect와 TestRunResult 연결
- Result 행에서 연결 결함 표시

### 보고서

- Project Report DB 집계 API
- KPI
- 기본 차트
- Top Failed TC

### 워크스페이스 설정

- Workspace DB/API 기반 일반 정보 조회/수정
- WorkspaceMember DB/API 기반 멤버 목록
- 역할 및 권한 보기
- 권한 기반 설정 저장/위험구역 버튼 비활성화
- 위험구역 UI
- v0.1에서 멤버 초대와 대기 중인 초대 처리는 mock 또는 read-only 수준

## 3. v0.1 제외 범위

아래 항목은 v0.1 완료 범위에 포함하지 않는다.

- 실시간 협업
- 댓글, 멘션, 알림
- Jira / GitHub / Slack 연동
- 첨부파일 실제 저장
- `.xlsx` 직접 업로드
- PDF 생성
- 보고서 공유 링크
- QR 코드
- 멤버 초대 이메일 발송
- 세밀한 RBAC 권한 커스터마이징
- Test Plan을 Test Run보다 상위 엔티티로 분리하는 고도화
- QA Action / Command Center 전체 재구현
- 감사 추적 전체 구현
- Retest Queue
- Release Readiness

## 4. 사용자 역할과 권한

v0.1은 Admin / Member / Viewer 역할을 기준으로 API guard와 주요 UI 버튼 비활성화를 적용한다. UI는 편의 장치이며, 권한 집행의 기준은 route-level API guard다.

| 역할 | 읽기 | 생성 | 수정 | 삭제 | 위험구역 |
| --- | --- | --- | --- | --- | --- |
| Admin | 가능 | 가능 | 가능 | 가능 | 가능 |
| Member | 가능 | 가능 | 가능 | 불가 | 불가 |
| Viewer | 가능 | 불가 | 불가 | 불가 | 불가 |

권한 적용 범위:

- Workspace API
- Projects API
- Dashboard API
- Project Report API
- TestCase / TestFolder API
- CSV Import / XLSX Template / AI Draft API
- TestRun / TestRunResult API
- Defect / DefectLink API

후속 Phase에서는 멤버 초대, 역할 변경, 더 세밀한 permission set, 프로젝트 단위 예외 권한을 다룬다.

## 5. 핵심 사용자 흐름

1. 사용자가 회원가입 또는 로그인한다.
2. 비로그인 사용자가 보호 페이지에 접근하면 `/login?next=...`로 이동한다.
3. 로그인 성공 후 안전한 내부 `next` 경로 또는 `/dashboard`로 이동한다.
4. 대시보드에서 현재 워크스페이스의 품질 현황을 확인한다.
5. 프로젝트 목록에서 새 프로젝트를 생성한다.
6. 프로젝트의 테스트케이스 화면으로 이동한다.
7. 테스트케이스를 직접 생성하거나 CSV Import로 가져온다.
8. 필요한 경우 Quick Edit 또는 Bulk Edit로 테스트케이스를 정리한다.
9. 테스트 실행 화면에서 새 Test Run을 생성한다.
10. 실행 대상 Test Case를 선택한다.
11. 선택된 Test Case 기준으로 TestRunResult가 pending 상태로 생성된다.
12. Runner 화면 또는 Drawer에서 TC별 결과를 입력한다.
13. failed 또는 blocked 결과에서 Defect를 생성한다.
14. 결함 화면에서 상태, 심각도, 우선순위, 담당자를 관리한다.
15. 보고서 화면에서 KPI, 차트, Top Failed TC를 확인한다.

## 6. 화면 목록과 라우트

| 화면 | 라우트 | v0.1 포함 |
| --- | --- | --- |
| 로그인 | `/login` | 포함 |
| 회원가입 | `/signup` | 포함 |
| 대시보드 | `/dashboard` | 포함 |
| 프로젝트 목록 | `/projects` | 포함 |
| 테스트케이스 | `/projects/:projectId/testcases` | 포함 |
| 테스트 실행 목록 | `/projects/:projectId/runs` | 포함 |
| 테스트 실행 상세/Runner | `/projects/:projectId/runs/:runId` | 포함 |
| 결함 | `/projects/:projectId/bugs` | 포함 |
| 보고서 | `/projects/:projectId/reports` | 포함 |
| 워크스페이스 설정 | `/settings` | 포함 |

## 7. 주요 도메인 모델

v0.1 기준 Prisma DB 모델은 다음과 같다.

- User
- Session
- RateLimitBucket
- Workspace
- WorkspaceMember
- Project
- TestFolder
- TestCase
- TestStep
- AiTestCaseDraft
- TestRun
- TestRunResult
- Defect
- DefectLink

아래 모델/개념은 v0.1에서 별도 DB 테이블로 구현하지 않는다.

| 항목 | v0.1 처리 |
| --- | --- |
| TestCaseImportJob / ImportRow | 별도 테이블 없이 stateless preview + commit payload 방식 |
| ActivityEvent | Dashboard 최근 활동은 TestRun / Defect 데이터에서 계산 |
| LocalBackupSnapshot | 별도 테이블 없이 localStorage backup snapshot으로만 사용 |

Test Plan은 v0.1에서 별도 상위 엔티티로 분리하지 않는다. 화면 문구에서는 "테스트 실행"을 우선 사용하고, 데이터 모델은 `TestRun`을 기준으로 한다.

## 8. API/DB 저장 정책

저장 정책은 다음을 기준으로 한다.

- Source of truth는 API와 PostgreSQL DB다.
- localStorage는 fallback, backup, draft, UI preference 용도로만 사용한다.
- API 쓰기 실패 시 성공처럼 처리하지 않는다.
- 쓰기 실패 시 사용자에게 에러 메시지를 표시한다.
- API 읽기 실패 시 마지막 backup snapshot 표시를 허용할 수 있다.
- backup snapshot을 표시할 때는 사용자가 현재 데이터 출처를 알 수 있어야 한다.
- localStorage와 DB 데이터를 자동 병합하지 않는다.
- localStorage 전용 데이터가 DB 저장 대상이 될 때는 명시적인 동기화 또는 저장 액션을 거친다.

localStorage 사용 후보:

- 마지막 성공 API 응답 backup
- CSV Import 미리보기 UI 상태
- AI Draft 모달 UI 상태
- Drawer width
- Table view mode
- 필터/정렬 preference

AI Draft 자체는 `AiTestCaseDraft` DB 모델에 저장한다. CSV Import preview는 v0.1에서 DB 저장 없이 요청/응답 payload로 처리한다.

### 인증/세션 정책

- 인증 방식은 custom credentials + DB-backed opaque session cookie다.
- 세션 쿠키 이름은 `tf_session`이다.
- 세션 만료는 14일이다.
- cookie는 HttpOnly, SameSite=Lax, Path=/로 설정한다.
- production 환경에서만 Secure cookie를 사용한다.
- DB `Session`에는 session token 원문을 저장하지 않고 SHA-256 `tokenHash`만 저장한다.
- 로그아웃 시 현재 Session을 삭제하고 cookie를 만료시킨다.
- 앱 내부 페이지는 middleware에서 `tf_session` cookie 존재 여부를 기준으로 1차 보호한다.
- 주요 API는 route-level guard에서 실제 세션, current workspace, project access, permission을 검증한다.
- 로그인 성공 후 `next` 파라미터는 `/`로 시작하는 내부 상대 경로만 허용한다.
- `POST`, `PUT`, `PATCH`, `DELETE` API는 Origin 우선, Referer fallback 방식의 same-origin CSRF guard를 통과해야 한다.
- 로그인 API는 IP 기준 10회/10분, email 실패 기준 5회/10분 rate limit을 적용한다.
- 회원가입 API는 IP 기준 5회/10분 rate limit을 적용한다.
- rate limit 초과 시 `429 RATE_LIMITED`를 반환한다.
- 로그인 성공 시 해당 email failure bucket은 reset한다.

## 9. Test Case 요구사항

### v0.1 포함

- Test Case 목록 조회
- Test Case 생성
- Test Case 상세 조회
- Test Case 수정
- Test Case 삭제
- Folder Tree 기반 분류
- TC Table 표시
- 행 클릭 시 TC Drawer 열기
- TC Drawer에서 주요 필드 편집
- CSV Import preview / commit
- XLSX template download
- Quick Edit
- Bulk Edit
- AI Draft 생성 및 선택 저장

### 필드

- id
- projectId
- folderId
- title
- description
- preconditions
- priority: high, medium, low
- status: draft, ready, deprecated
- tags
- steps
- expectedResult
- createdBy
- updatedAt

### CSV Import

CSV Import는 다음 흐름을 따른다.

1. 사용자가 CSV 파일을 선택한다.
2. Import Preview API가 파일을 파싱한다.
3. 영어/한국어 컬럼을 TestCase 필드로 매핑한다.
4. 필수값과 enum 값을 검증한다.
5. 정상 행과 오류 행을 미리보기로 표시한다.
6. 사용자가 유효 행 가져오기를 실행한다.
7. 유효 행만 Commit API에서 DB에 저장한다.

v0.1에서 `.xlsx` 직접 업로드는 지원하지 않는다. XLSX는 작성용 템플릿 다운로드까지만 제공한다.

### Quick Edit

- 목록에서 선택한 단일 Test Case를 빠르게 편집한다.
- v0.1 구현은 TC Drawer 기반 편집으로 제공한다.
- 제목, 설명, 사전조건, 우선순위, 상태, 태그, 기대 결과, 테스트 단계를 수정할 수 있어야 한다.

### Bulk Edit

- 여러 Test Case를 선택해 공통 필드를 일괄 변경한다.
- v0.1 대상 필드는 상태, 우선순위, 태그, 폴더 이동으로 제한한다.
- 태그는 추가 또는 덮어쓰기 정책을 지원한다.

### AI Draft

- AI 생성 결과는 `AiTestCaseDraft`로 취급한다.
- 사용자가 선택 저장하기 전까지 TestCase로 저장하지 않는다.
- API 실패, timeout, schema validation 실패, rate limit, 네트워크 실패 시 rule-based fallback을 사용한다.
- `OPENAI_API_KEY`가 없을 때도 fallback으로 초안을 생성한다.
- 선택 저장 시 TestCase와 TestStep이 DB에 저장되고 Draft 상태는 saved로 변경된다.

## 10. Test Run / Result 요구사항

### v0.1 포함

- Test Run 목록 조회
- Test Run 생성
- Test Run 상세 조회
- 실행 대상 Test Case 선택
- 선택한 Test Case 기준 TestRunResult 자동 생성
- Runner 화면 또는 Drawer
- Result 상태 변경
- 상태 변경 즉시 저장
- 결과 저장 후 다음 TC로 이동
- failed / blocked Result에서 Defect 생성 연결
- Result 행에서 연결 Defect 수 표시

### Result 상태

| 상태 | 설명 |
| --- | --- |
| pending | 아직 실행하지 않음 |
| passed | 통과 |
| failed | 실패 |
| blocked | 차단 |
| skipped | 건너뜀 |

### Test Run 생성

Test Run 생성 시 사용자는 현재 프로젝트의 Test Case를 선택한다. 저장 시 선택한 Test Case마다 초기 `pending` TestRunResult를 생성한다.

Test Run과 TestRunResult 생성은 가능한 한 하나의 transaction으로 처리한다.

### Runner UX

- 좌측 또는 Drawer에 실행 대상 목록을 표시한다.
- 우측 또는 본문에 현재 TC의 사전조건, 단계, 기대 결과, 실제 결과 입력 영역을 표시한다.
- Pass / Fail / Block / Skip 버튼은 가장 중요한 액션으로 시각적으로 명확하게 표시한다.
- 상태 변경 후 자동으로 다음 미실행 TC로 이동한다.
- 마지막 TC 처리 후 완료 안내를 표시한다.

## 11. Defect 요구사항

### v0.1 포함

- Defect 목록 조회
- Defect 상세 조회
- Defect 생성
- Defect 수정
- Defect 삭제
- Jira 스타일 테이블
- Defect Drawer
- TestCase 연결
- TestRunResult 연결
- failed / blocked Result에서 Defect 생성
- Result 행에서 연결 결함 표시

### 상태

- open
- in_progress
- resolved
- closed

### 심각도

- critical
- major
- minor
- trivial

### 우선순위

- high
- medium
- low

### 연결 정책

Defect는 프로젝트에 속한다. Defect는 하나 이상의 TestCase 또는 TestRunResult와 연결될 수 있다.

failed / blocked Result에서 Defect를 생성할 때는 다음 연결을 저장한다.

- projectId
- testRunResultId
- testRunResult가 참조하는 testCaseId
- defectId

이 연결은 새로고침 후에도 유지되어야 한다.

## 12. Report 요구사항

v0.1 보고서는 기본 품질 현황을 확인하는 수준으로 제한한다.

### 포함 지표

- 총 실행 수
- Pass 비율
- 발견 결함 수
- 일별 실행 추이
- 결과 비율
- 결함 트렌드
- Top Failed TC

### v0.1 제외

- PDF 생성
- 공유 링크
- QR 코드
- 고급 필터 프리셋
- 드릴다운 분석
- 감사용 리포트 패키징

보고서 데이터는 DB에 저장된 TestRunResult와 Defect를 기준으로 집계한다. mock 데이터는 초기 seed 또는 빈 상태 보조 용도로만 사용한다.

Dashboard 데이터는 `/api/dashboard/summary`, Project Report 데이터는 `/api/projects/:projectId/reports/summary` 집계 API를 기준으로 한다.

## 13. Workspace Settings 요구사항

### v0.1 포함

- Workspace DB/API 기반 일반 정보 화면
- WorkspaceMember DB/API 기반 멤버 목록 화면
- 역할 및 권한 보기 화면
- 위험구역 UI

### 일반 정보

- 워크스페이스 이름
- slug
- 시간대
- 로고 UI

### 멤버

- 활성 멤버 목록
- 역할 표시
- 대기 중인 초대 UI는 mock 또는 read-only 수준

### 역할 및 권한

- Admin / Member / Viewer 설명
- 권한 매트릭스 표시
- v0.1에서는 권한 커스터마이징을 제공하지 않는다.

### 위험구역

- 워크스페이스 삭제 UI를 표시할 수 있다.
- 실제 영구 삭제 처리는 후속 Phase에서 구현한다.

## 14. 기술 스택

v0.1 권장 기술 스택은 다음과 같다.

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui 사용 가능 구조
- lucide-react
- Prisma
- PostgreSQL
- papaparse
- exceljs

v0.1 구현은 React state와 fetch 기반 클라이언트 상태 관리를 사용한다. 인증 상태는 AuthProvider로 중앙화한다. TanStack Query, Zustand, React Hook Form, Zod는 후속 구조 개선 시 도입 후보로 둔다.

XLSX 템플릿 다운로드는 서버 API에서 exceljs로 생성한다. v0.1에서 직접 `.xlsx` 업로드는 지원하지 않는다.

## 15. 구현 마일스톤

| 마일스톤 | 범위 |
| --- | --- |
| M0 | PRD/설계 확정 |
| M1 | 앱 초기 세팅 및 공통 레이아웃 |
| M2 | DB/Prisma/Seed |
| M3 | Project/TestCase |
| M4 | CSV/XLSX/AI Draft |
| M5 | Test Run/Result |
| M6 | Defect 연결 |
| M7 | Dashboard/Report/Settings |
| M8 | 테스트/빌드 안정화 |

## 16. 완료 기준

v0.1은 아래 조건을 만족해야 완료로 본다.

- `npm run build` 통과
- `npm run lint` 통과
- `npm run test:auth` 또는 `npm run test:smoke` 통과
- 주요 happy path 브라우저 검증 완료
- 로그인/회원가입 API와 UI가 동작함
- 보호 페이지 비로그인 접근 시 `/login?next=...`로 이동함
- 로그인 성공 후 safe next redirect가 동작함
- Admin / Member / Viewer 권한에 따라 API guard가 동작함
- 주요 UI 위험 액션 버튼이 권한에 맞게 숨김 또는 비활성화됨
- Test Case 생성/수정/삭제가 DB에 저장됨
- CSV Import 결과가 DB에 저장됨
- XLSX 템플릿 다운로드가 동작함
- AI Draft 생성과 선택 저장이 동작함
- Test Run 생성 시 선택한 Test Case 기준 Result가 생성됨
- Result 상태 변경이 DB에 저장됨
- failed / blocked Result에서 Defect 생성 가능
- 생성된 Defect와 TestCase/TestRunResult 연결이 유지됨
- 새로고침 후 TestCase, TestRun, Result, Defect 데이터가 유지됨
- API 쓰기 실패를 성공처럼 표시하지 않음
- localStorage backup 표시 시 사용자가 알 수 있음

## 17. 인증/권한 Smoke Test

v0.1은 Node 기반 auth permission smoke test를 제공한다. 이 테스트는 Playwright 같은 브라우저 E2E를 대체하지 않고, 인증/권한 API 회귀를 빠르게 잡기 위한 최소 통합 테스트다.

실행:

```bash
npm run db:reset:dev
npm run test:auth
```

`npm run test:smoke`는 `npm run test:auth`의 alias다.

검증 범위:

- 비로그인 보호 페이지 접근 시 `/login?next=...` redirect
- 비로그인 보호 API 401
- Admin 로그인과 쓰기 권한
- Member 생성/수정 권한 및 삭제 거부
- Viewer 조회 권한 및 쓰기 거부
- Dashboard / Report 보호 API 접근
- logout 후 세션 무효화

개발 seed 계정:

| 역할 | 이메일 | 비밀번호 |
| --- | --- | --- |
| Admin | `qa.lead@testflow.local` | `password123!` |
| Member | `backend@testflow.local` | `password123!` |
| Member | `frontend@testflow.local` | `password123!` |
| Viewer | `pm@testflow.local` | `password123!` |

## 18. 리스크

| 리스크 | 설명 | 대응 |
| --- | --- | --- |
| TestPlan/TestRun 용어 혼동 | 화면 요청서는 테스트 플랜 용어를 쓰지만 v0.1 모델은 TestRun 중심 | v0.1에서는 TestRun으로 통일하고 TestPlan은 후속 Phase |
| CSV/XLSX 범위 오해 | 사용자가 `.xlsx` 직접 업로드를 기대할 수 있음 | 템플릿 다운로드와 CSV 업로드 정책을 UI에 명확히 표시 |
| localStorage fallback 오용 | fallback이 source of truth처럼 동작할 수 있음 | DB 우선, backup 표시, 자동 병합 금지 |
| AI 초안 품질 | 생성 결과가 실제 요구사항과 다를 수 있음 | 저장 전 사용자 검토 필수 |
| AI API 불안정 | API key 누락, 모델 응답 실패, JSON 파싱 실패 가능 | rule-based fallback으로 초안 생성 |
| Defect와 Result 연결 누락 | 결함 추적 맥락이 끊길 수 있음 | Result 기반 Defect 생성 시 testCaseId/testRunResultId 연결 유지 |
| Report 데이터 부족 | 초기에는 차트가 mock처럼 보일 수 있음 | seed/empty state를 구분하고 실제 DB 집계를 우선 |
| 권한 UI와 실제 권한 차이 | UI 비활성화와 API guard가 어긋날 수 있음 | API guard를 기준으로 두고 smoke test로 회귀 확인 |
| CSRF | Origin/Referer guard는 적용했지만 토큰 기반 방어는 아직 없음 | 필요 시 double-submit token 등 추가 hardening 검토 |
| 인증 rate limit 범위 | 로그인/회원가입은 보호하지만 AI/CSV/write API rate limit은 아직 없음 | 비용/부하가 큰 API부터 후속 적용 |
| 세션 정리 정책 | 만료 세션 정리/rotation 정책이 최소 수준 | 운영 전 cleanup job과 rotation 검토 |
| UI E2E 공백 | Node smoke test는 API/RBAC 중심이며 실제 브라우저 버튼 상태는 제한적으로만 보장 | Playwright UI E2E를 후속으로 추가 |
| audit moderate | high 취약점은 제거했지만 moderate 항목은 운영 전 별도 검토 필요 | 배포 전 `npm audit` 기준 재검토 |

## 19. 후속 Phase

v0.1 이후 후보 기능은 다음과 같다.

- Test Plan 별도 엔티티
- PDF 생성
- 보고서 공유 링크
- QR 코드
- 첨부파일 실제 저장
- 멤버 초대 이메일
- 세밀한 RBAC 권한 커스터마이징
- CSRF token hardening
- AI/CSV/write API rate limit
- 만료 세션 정리와 세션 rotation
- Playwright UI E2E
- audit moderate 항목 운영 전 검토
- Jira / GitHub / Slack 연동
- 실시간 협업
- 댓글 / 멘션 / 알림
- 감사 추적
- Retest Queue
- Release Readiness
- AI 결함 요약
- AI 릴리즈 리스크 요약
- AI 생성 이력 및 사용량 제한

## 20. PRD 운영 규칙

- 구현 전에 이 문서의 범위를 먼저 확인한다.
- v0.1 포함/제외 범위가 바뀌면 코드 변경 전에 PRD를 갱신한다.
- 구현되지 않은 기능을 완료된 기능처럼 문서화하지 않는다.
- 화면 요청서의 UX를 따르되, MVP 목표에 맞지 않는 기능은 후속 Phase로 분리한다.
- 기존 프로젝트 PRD는 기능 검증 근거로만 참고하고 새 프로젝트 구조에 맞게 재설계한다.
