# [F-PROJ] 프로젝트(Project) 관리

| 항목 | 내용 |
| --- | --- |
| 기능 ID | F-PROJ |
| 상태 | 검토 |
| 우선순위 | High |
| 관련 도메인(glossary) | Project, Workspace, User, Role |
| Figma | https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=0-1&p=f&m=dev |
| 작성자 | 기능 기획자 에이전트 |
| 최종 수정일 | 2026-06-05 |

> 본 기능은 Workspace 하위의 **Project 단위 격리**의 생성·조회·수정·비활성·멤버 초대를 다룬다. Project 멤버 초대(진입)는 PO 권한이며 기본 Role은 Member (CO가 사전 부여한 Role 있으면 유지). Role 승격은 CO 권한(F-USER). 권한 매트릭스: [`permissions.md`](../permissions.md) §4.3.

## 1. 개요 / 목적
- Workspace 내부에서 테스트 자산(Suite·TC·Plan·Run·Defect·Attachment)을 담는 **Project 단위**를 관리한다.
- PO는 본인이 PO인 Project가 속한 WS 내에서 신규 Project를 생성하며, 멤버를 초대해 협업한다.
- Member도 Project 생성 가능하나 **생성해도 Member 유지(PO 자동 승격 X)** — 권한 매트릭스 §4.3 ★8.

## 2. 관련 용어
| 용어 | 정의 요약 |
| --- | --- |
| Project | Workspace 하위 테스트 자산 컨테이너 (glossary §6) |
| PO | Project Owner. Project 멤버 초대·Project·TC·TestRun CRUD |

## 3. 사용자 / 권한
| Role | 권한 |
| --- | --- |
| CO | 본인 Company 내 모든 Project 조회, 비활성/활성. Project 생성·삭제 직접 권한 없음(PO/WO/Member 경로) |
| WO | **본인 소유/멤버 WS 내 Project 생성·정보 수정·비활성/활성·목록·상세 조회** (★15). 멤버 초대·내부 자산 작업은 별도 Role 필요 |
| PO | 본인이 PO인 WS에서 Project 생성, 본인 Project 정보 수정·비활성·멤버 초대 |
| Member | 본인이 멤버인 WS에서 Project 생성(생성 후에도 Member 유지) |
| Viewer | 본인이 멤버인 Project read-only |

> 권한 매트릭스 정본: [`permissions.md`](../permissions.md) §4.3.

## 4. 사용자 스토리
- **PO**로서, 새 테스트 영역을 만들기 위해, Workspace 내에 Project를 생성한다.
- **Member**로서, 본인 작업용 Project를 직접 생성할 수 있다(권한은 Member 유지).
- **PO**로서, 협업자를 들이기 위해, WS 멤버 중 일부를 Project 멤버로 초대한다(기본 Member, CO가 사전 부여한 Role 있으면 유지).
- **CO**로서, 운영 종료된 Project를 차단하기 위해, 비활성화한다.
- **인증된 사용자**로서, 내가 멤버인 Project만 좌측 셀렉터·목록에서 본다.

## 5. 주요 흐름 / 시나리오

### 5.1 Project 생성 (WO·PO·Member)
1. WO/PO/Member가 WS 컨텍스트에서 `/workspaces/{wsId}/projects` → "새 프로젝트".
2. 이름·**code(단축식별자)**·설명 입력 → `POST /api/v1/workspaces/{wsId}/projects`.
   - 프론트는 name에서 ASCII 대문자 첫 4자로 `code` 자동 제안. 사용자 override 허용.
3. 서버 검증:
   - 요청자가 해당 WS의 **WO / PO / Member** 중 1개 이상 보유
   - WS 활성 상태
   - `code` 형식 `^[A-Z][A-Z0-9]{1,9}$` (2~10자)
   - `code` Company 내 unique
4. `projects` 생성, `owner_user_id`:
   - PO가 생성 시 → 요청자가 owner (자동 PO 부여 X — PO는 이미 보유). 정확히는 `user_roles`에 `(요청자, PROJECT, projId, PO)` 추가.
   - Member가 생성 시 → `owner_user_id`는 요청자, **`user_roles`에 PO 부여 안 함** (요청자는 Member 유지). 이 경우 Project는 **PO 없는 상태**로 생성됨.

> Member 생성 Project의 PO 부재 처리: WO나 CO가 차후 누군가에게 PO 부여. **마지막 PO 회수 규칙**은 PO가 있는 경우에만 적용 — Member 생성 직후 PO 0명 상태는 허용.
> WO 생성 Project의 PO 부재 처리: WO가 본인을 PO로 동시 부여하려면 CO에게 요청. WO 자체로는 Project 컨테이너 수준 관리(이름·설명·활성) 가능하나 **내부 자산(Suite/TC/Plan/Run/Defect) 작업은 PO/Member Role 필요**.

### 5.2 Project 목록 조회
- `GET /api/v1/workspaces/{wsId}/projects`.
- 가시 필터: CO(WS 모든 Project), WO(WS 내 모든 Project), PO/Member/Viewer(본인이 멤버인 Project만).
- 쿼리: `q`·`isActive`·`role`·page·size·sort.

### 5.3 Project 상세 조회
- `GET /api/v1/projects/{projId}` → 권한 검증 후 상세.
- 응답: id, name, description, isActive, owner(요약), workspace(요약), memberCount, testCaseCount, defectCount, createdAt 등.

### 5.4 Project 정보 수정 (WO·PO)
1. WO(상위 WS 보유) 또는 PO가 `/projects/{projId}/settings` → 이름·설명 수정 → `POST /api/v1/projects/{projId}/update`.

### 5.5 Project 비활성/활성 (CO·WO·PO)
1. CO 또는 WO(상위 WS 보유) 또는 PO가 비활성화 → 확인 다이얼로그 → `POST /api/v1/projects/{projId}/deactivate`.
2. 서버: `is_active=false`. 비활성 Project 내 모든 액션 차단(조회 외) → 403 `PROJ_INACTIVE`.
3. 활성화: `POST /api/v1/projects/{projId}/activate`.

### 5.6 Project 멤버 초대 (PO)
1. PO가 `/projects/{projId}/members` → "초대".
2. **같은 WS의 멤버**만 선택 가능. 다중 선택 → `POST /api/v1/projects/{projId}/members`.
3. 서버 검증: 대상자가 같은 WS 멤버인지 확인 → `user_roles`에 `(userId, PROJECT, projId, MEMBER)` 추가 (`(userId, PROJECT, projId)` 행 이미 존재 시 기존 Role 유지 — CO 사전 부여 우선).
4. WS 멤버 아닌 사용자 초대 시도 → 400 `USER_NOT_IN_WORKSPACE`.

### 5.7 Project 멤버 제거 (PO)
1. PO가 멤버 옆 "제거" → 확인 다이얼로그 → `POST /api/v1/projects/{projId}/members/{userId}/remove`.
2. 서버: 해당 사용자의 Project Scope Role 전부 삭제(`scope_type=PROJECT, scope_id=projId`).
3. 마지막 PO 제거 시도 → 400 `PROJ_LAST_PO_FORBIDDEN`.

### 5.8 대안 / 예외 흐름
- 비활성 Company/WS 내 Project 작업 → 403 `COMPANY_INACTIVE`/`WS_INACTIVE` (상위 비활성 우선).
- 비활성 Project 내 작업 → 403 `PROJ_INACTIVE`.
- 다른 Company/WS의 Project 접근 → 404 (격리 은닉).
- 본인이 멤버 아닌 Project 접근 → 404 (은닉) 또는 403(상황별).
- 마지막 PO 회수 → 400 `PROJ_LAST_PO_FORBIDDEN`.
- WS 멤버 아닌 사용자 Project 초대 → 400 `USER_NOT_IN_WORKSPACE`.

## 6. 입력 / 출력

### 6.1 입력
| 구분 | 항목 | 설명/제약 |
| --- | --- | --- |
| 생성 | name | 필수, 1~100자 |
| 생성 | code | 필수, `^[A-Z][A-Z0-9]{1,9}$` (2~10자), Company 내 unique, **불변** |
| 생성 | description | 선택, 0~1000자 |
| 수정 | name/description | 부분 변경 (**code는 변경 불가**) |
| 멤버 초대 | userIds[] | 필수, 같은 WS 멤버 |
| 멤버 제거 | (Path) userId | 필수 |
| 목록 | q / isActive / role / page / size / sort | 모두 선택 |

### 6.2 출력
| 구분 | 항목 | 설명 |
| --- | --- | --- |
| Project 표현 | id, name, **code**, description, isActive, owner, workspace, memberCount, testCaseCount, defectCount, createdAt | `code`는 TC/Defect 코드 prefix 정본 |
| 멤버 표현 | userId, email, name, role | |
| 응답 래퍼 | `success/code/message/data` | backend §4.5 |

## 7. 비즈니스 규칙
- **Project 생성 권한**: 해당 WS의 **WO / PO / Member** 중 1개 이상 보유자.
- **Project 정보 수정·비활성/활성 권한**: WO(상위 WS 보유) 또는 PO. CO는 비활성/활성만 직접 가능(수정은 WS 단위 정책 — Phase 2).
- **WO의 Project 권한 범위(컨테이너 한정)** (permissions ★15): 생성·이름·설명·활성. **내부 자산 작업(Suite/TC/Plan/Run/Defect/Attachment)과 멤버 초대는 WO 권한 외**, 별도 PO/Member Role 필요. WO는 자산 트리·요약만 read.
- **Project `code` 정본**: 형식 `^[A-Z][A-Z0-9]{1,9}$` (2~10자), Company 내 unique, **생성 후 변경 불가**. TC code(`TC-<code>-<seq>`)·Defect code(`DEF-<code>-<seq>`)의 prefix로 사용.
- **Member 생성 후 PO 자동 부여 X** (답 7 확정).
- **마지막 PO 보호**: PO가 1명 이상 부여된 Project에서 마지막 PO 회수 불가. Member 생성 직후 PO 0명 상태는 허용(Phase 2에서 자동 알림 권장).
- **Project 멤버는 같은 WS 멤버 한정**: 다른 WS·다른 Company 사용자 초대 불가.
- **비활성 Project 격리**: 비활성 Project 내 모든 도메인(Suite/TC/Plan/Run/Defect/Attachment) 액션 차단(조회 포함 403 `PROJ_INACTIVE`).
- **격리키 보존**: `projects.company_id`, `projects.workspace_id` 보유. 하위 테이블은 3종 격리키 모두 보유.
- **물리 삭제 금지**: 비활성으로만 종결.

## 8. 예외 / 에러
| 상황 | 처리 | 에러 코드 |
| --- | --- | --- |
| 미인증 | 401 | `AUTH_UNAUTHORIZED` |
| 권한 부족 | 403 | `AUTH_FORBIDDEN` |
| 미존재 Project | 404 | `PROJ_NOT_FOUND` |
| `code` 형식 위반 | 400 | `PROJ_CODE_INVALID` |
| `code` 중복(Company 내) | 409 | `PROJ_CODE_DUPLICATE` |
| `code` 변경 시도(생성 후) | 400 | `PROJ_CODE_IMMUTABLE` |
| 비활성 Company 액션 | 403 | `COMPANY_INACTIVE` |
| 비활성 WS 액션 | 403 | `WS_INACTIVE` |
| 비활성 Project 액션 | 403 | `PROJ_INACTIVE` |
| 마지막 PO 회수/제거 | 400 | `PROJ_LAST_PO_FORBIDDEN` |
| WS 멤버 아닌 사용자 Project 초대 | 400 | `USER_NOT_IN_WORKSPACE` |
| 입력 형식 오류 | 400 | `COMMON_INVALID_INPUT` |

## 9. 수용 기준 (Acceptance Criteria)
- [ ] **AC-1** Given WS에서 PO 보유, When 새 Project 생성하면, Then 200 + Project 생성 + `user_roles`에 `(요청자, PROJECT, projId, PO)` 1행 추가.
- [ ] **AC-2** Given Member 보유, When 새 Project 생성하면, Then 200 + Project 생성. **PO 부여 없음**, 요청자는 Member 유지.
- [ ] **AC-3** Given WS 권한 미보유, When Project 생성 시도하면, Then 403 `AUTH_FORBIDDEN`.
- [ ] **AC-4** Given PO, When `GET /workspaces/{wsId}/projects` 호출하면, Then 본인 멤버 Project 목록을 받는다.
- [ ] **AC-5** Given CO, When 호출하면, Then WS 전체 Project 목록.
- [ ] **AC-6** Given PO, When 같은 WS 멤버를 Project 초대하면, Then `user_roles`에 `(userId, PROJECT, projId, MEMBER)` 추가. 단 해당 행이 이미 존재(CO 사전 부여) 시 기존 Role 유지.
- [ ] **AC-7** Given PO, When 다른 WS 사용자 초대하면, Then 400 `USER_NOT_IN_WORKSPACE`.
- [ ] **AC-8** Given Project의 마지막 PO, When 회수/제거 시도하면, Then 400 `PROJ_LAST_PO_FORBIDDEN`.
- [ ] **AC-9** Given CO, When Project 비활성하면, Then 그 Project 내 모든 도메인 API 403 `PROJ_INACTIVE`.
- [ ] **AC-10** Given 비활성 WS 내 Project, When 접근하면, Then 403 `WS_INACTIVE` (상위 비활성 우선).
- [ ] **AC-11** Given 다른 Company/WS의 Project, When 접근하면, Then 404 (은닉).
- [ ] **AC-12** Given Member 생성 Project(PO 0명), When CO가 다른 사용자에게 PO 부여하면, Then 200, 그 사용자는 PO가 된다.
- [ ] **AC-13** Given `code="ab"` (소문자), When 생성하면, Then 400 `PROJ_CODE_INVALID`.
- [ ] **AC-14** Given 같은 Company에 `code="WEB"` Project 기존, When 같은 code로 생성, Then 409 `PROJ_CODE_DUPLICATE`.
- [ ] **AC-15** Given 다른 Company의 동일 `code`, When 생성, Then 200 (Company 단위 unique).
- [ ] **AC-16** Given 기존 Project, When `update`에 code 포함 전송, Then code는 무시(불변, 변경 없이 200) 또는 명시 거부(권장 거부 — 명세 시 결정). **MVP 정책: 거부 400 `PROJ_CODE_IMMUTABLE`**.
- [ ] **AC-17** Given WO(소유 WS), When 그 WS 내에 신규 Project 생성하면, Then 200 + Project 생성(요청자 PO 자동 부여 없음, ★15 적용).
- [ ] **AC-18** Given WO(소유 WS), When 그 WS Project의 이름·설명 수정, Then 200.
- [ ] **AC-19** Given WO(소유 WS), When 그 WS Project 비활성/활성하면, Then 200.
- [ ] **AC-20** Given WO(소유 WS) + Project Scope Role 미보유, When 그 Project 멤버 초대 시도, Then 403 `AUTH_FORBIDDEN` (WO는 컨테이너 한정).
- [ ] **AC-21** Given WO(소유 WS) + Project Scope Role 미보유, When 그 Project 내 TC/Plan/Run/Defect 생성 시도, Then 403 `AUTH_FORBIDDEN`.
- [ ] **AC-22** Given WO이지만 다른 WS, When 그 WS Project 작업 시도, Then 404(은닉) 또는 403(WS 컨텍스트).

## 10. 추적성
| Requirement ID | 설명 | 관련 기능/화면 | 관련 API(개념) | 연관 TestCase |
| --- | --- | --- | --- | --- |
| REQ-PROJ-001 | PO/Member의 Project 생성 | /workspaces/{id}/projects | `POST /workspaces/{id}/projects` | (QA) |
| REQ-PROJ-002 | Project 목록 조회(Role 기반 가시 필터) | /workspaces/{id}/projects | `GET /workspaces/{id}/projects` | (QA) |
| REQ-PROJ-003 | Project 정보 수정 | /projects/{id}/settings | `POST /projects/{id}/update` | (QA) |
| REQ-PROJ-004 | Project 비활성/활성 | /projects/{id}/settings | `POST /projects/{id}/(de)activate` | (QA) |
| REQ-PROJ-005 | Project 멤버 초대(같은 WS 한정) | /projects/{id}/members | `POST /projects/{id}/members` | (QA) |
| REQ-PROJ-006 | Project 멤버 제거 | /projects/{id}/members | `POST /projects/{id}/members/{userId}/remove` | (QA) |
| REQ-PROJ-007 | 마지막 PO 보호 | 전역 | (서비스 규칙) | (QA) |
| REQ-PROJ-008 | Member 생성 시 PO 자동 부여 금지 | 전역 | (서비스 규칙) | (QA) |
| REQ-PROJ-009 | 비활성 Project 격리 차단 | 전역 | (격리 필터) | (QA) |

## 11. 오픈 이슈 / 비고
- **Member 생성 Project의 PO 부재 알림**: PO 0명 상태가 장기 유지될 위험. WO/CO에 자동 알림 권장 — Phase 2 F-NOTIFY.
- **Project 멤버 다중 Role**: 한 사용자가 같은 Project에서 PO+Member 동시 보유 가능 여부 — 현재 모델은 가능하나 의미 충돌 우려. 권장: 단일 Role per Project. 검증 룰 추가는 Phase 2.
- **Project 단위 데이터 export/이관**: Phase 2.
- **Project 알림/이벤트**: 활동 피드 등 Phase 2.
