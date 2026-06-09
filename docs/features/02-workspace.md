# [F-WS] 워크스페이스(Workspace) 관리

| 항목 | 내용 |
| --- | --- |
| 기능 ID | F-WS |
| 상태 | 검토 |
| 우선순위 | High |
| 관련 도메인(glossary) | Workspace, User, Role |
| Figma | https://https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=278-4656&m=dev |
| 작성자 | 기능 기획자 에이전트 |
| 최종 수정일 | 2026-06-05 |

> 본 기능은 Company 내부의 **Workspace 격리 단위**의 생성·조회·수정·비활성·소유자 이관·**멤버 초대(Scope 진입)**를 다룬다. Workspace 멤버의 Role 승격은 **CO만 가능**(F-USER), 본 기능의 "멤버 초대"는 **WS 진입(기본 Member)**만 처리한다. 권한 매트릭스: [`permissions.md`](../permissions.md) §4.2.

## 1. 개요 / 목적
- Company 내부에서 팀·제품 단위로 **데이터 격리·접근 권한을 구분**하는 Workspace 단위를 관리한다.
- WO는 본인 소유 WS의 정보·멤버를 운영하며, 새 WS를 무제한으로 생성할 수 있다.
- CO는 모든 WS를 조회·비활성·소유자 이관할 수 있다.

## 2. 관련 용어
| 용어 | 정의 요약 |
| --- | --- |
| Workspace | 데이터 격리의 중간 경계. Company > Workspace > Project (glossary §6) |
| WO (Workspace Owner) | Workspace를 소유·운영하는 Role. CO 승격으로 부여 |
| 멤버 초대(WS) | 같은 Company에 등록된 사용자를 특정 WS에 추가 (기본 Role = Member, CO 사전 부여 Role 있으면 유지) |

## 3. 사용자 / 권한
| Role | 권한 |
| --- | --- |
| CO | 본인 Company 내 모든 WS 목록·상세 조회, 비활성/활성, 소유자 이관 |
| WO | 본인 소유 WS 생성(무제한), 정보 수정, 멤버 초대·제거 |
| PO/Member/Viewer | 본인이 멤버인 WS의 목록·상세 조회만 |
| Master | 시스템 메타 조회 한정(데모 미구현 가능) |

> 권한 매트릭스 정본: [`permissions.md`](../permissions.md) §4.2.

## 4. 사용자 스토리
- **WO**로서, 새 팀/제품 작업 공간을 만들기 위해, Workspace를 생성한다(무제한).
- **WO**로서, 협업할 사람을 들이기 위해, Company에 등록된 사용자를 본 WS의 멤버로 초대한다(기본 Member, CO가 사전 부여한 Role 있으면 유지).
- **WO**로서, 더 이상 협업하지 않는 사용자를 제거하기 위해, WS 멤버에서 제외한다.
- **CO**로서, 운영 책임을 다른 WO에게 옮기기 위해, WS 소유자를 이관한다.
- **CO**로서, 종료된 WS를 차단하기 위해, WS를 비활성화한다.
- **인증된 사용자**로서, 내가 멤버인 WS만 좌측 셀렉터에 보이게 하여, 빠르게 작업 공간을 전환한다.

## 5. 주요 흐름 / 시나리오

### 5.1 WS 생성 (WO)
1. WO가 `/workspaces` → "새 워크스페이스" 진입.
2. 이름·설명(선택) 입력 → `POST /api/v1/workspaces`.
3. 서버가 회사 내 WS 이름 유일성(권장: 회사 내 권장 unique, 강제는 옵션)을 확인 → `workspaces` 생성, `owner_user_id`=요청자, `user_roles`에 `(요청자, WORKSPACE, wsId, WO)` 추가.
4. 응답: 생성된 WS.

### 5.2 WS 목록 조회
- CO: `GET /api/v1/workspaces` → Company 내 전체 WS (페이지·필터).
- 일반 사용자: `GET /api/v1/workspaces` → 본인이 멤버인 WS만 자동 필터.
- 필터: `?q=keyword&isActive=true&role=WO|PO|MEMBER|VIEWER`.

### 5.3 WS 상세 조회
- `GET /api/v1/workspaces/{wsId}` → 권한 검증 후 상세.
- 응답: id, name, description, isActive, ownerUser(요약), memberCount, projectCount, createdAt 등.

### 5.4 WS 정보 수정 (CO 또는 WO)
1. `/workspaces/{wsId}/settings` 진입.
2. 이름·설명 수정 → `POST /api/v1/workspaces/{wsId}/update`.

### 5.5 WS 비활성/활성 (CO)
1. CO가 WS 상세 → "비활성화" → 확인 다이얼로그 → `POST /api/v1/workspaces/{wsId}/deactivate`.
2. 서버: `is_active=false`. 비활성 WS 내 모든 액션 차단(조회 외) → 403 `WS_INACTIVE`.
3. 활성화: `POST /api/v1/workspaces/{wsId}/activate`.

### 5.6 WS 소유자 이관 (CO)
1. CO가 `/workspaces/{wsId}/settings` → "소유자 이관".
2. 대상은 **현재 WS의 WO 보유자**만 가능. 없으면 사용자 Role 부여 화면으로 안내(F-USER).
3. `POST /api/v1/workspaces/{wsId}/transfer-ownership` → `owner_user_id` 갱신.
4. 기존 소유자의 WO 권한은 유지(다른 CO가 회수해야 해제).

### 5.7 WS 멤버 초대 (WO)
1. WO가 `/workspaces/{wsId}/members` → "초대".
2. 동일 Company에 등록된 사용자 검색(이메일/이름 부분일치) → 1명 또는 다수 선택 → "확인".
3. `POST /api/v1/workspaces/{wsId}/members`.
4. 서버가 사용자가 같은 Company 소속인지 검증(아니면 400 `USER_NOT_IN_COMPANY`), `user_roles`에 `(userId, WORKSPACE, wsId, VIEWER)` 추가(중복 시 무시).
5. **별도 이메일 발송은 없음**(이미 가입된 사용자). 알림은 Phase 2 F-NOTIFY.

### 5.8 WS 멤버 제거 (WO·CO)
1. 대상 멤버 옆 "제거" 클릭 → 확인 다이얼로그 → `POST /api/v1/workspaces/{wsId}/members/{userId}/remove`.
2. 서버가 해당 사용자의 WS Scope Role 전부 삭제(`scope_type=WORKSPACE, scope_id=wsId`).
3. **하위 Project 멤버 Role은 자동 삭제 X** — 격리 정합성을 위해 PO가 Project 멤버에서 별도 제거해야 함. (단, WS 비활성 시 하위 Project 접근 차단)
4. WS의 마지막 WO 제거 시도는 거부(`WS_LAST_WO_FORBIDDEN`).

### 5.9 대안 / 예외 흐름
- 비활성 Company 내 WS 작업 시도 → 403 `COMPANY_INACTIVE`.
- 비활성 WS 작업 시도 → 403 `WS_INACTIVE`.
- 다른 Company의 WS 접근 → 404 (격리 은닉).
- 본인이 멤버 아닌 WS 접근 → 404 (은닉) 또는 403(상황별).
- 마지막 WO 회수 → 400 `WS_LAST_WO_FORBIDDEN`.
- 다른 Company 사용자를 멤버 초대 시도 → 400 `USER_NOT_IN_COMPANY`.

## 6. 입력 / 출력

### 6.1 입력
| 구분 | 항목 | 설명/제약 |
| --- | --- | --- |
| 생성 | name | 필수, 1~100자 |
| 생성 | description | 선택, 0~500자 |
| 수정 | name/description | 부분 변경 |
| 멤버 초대 | userIds[] | 필수, 같은 Company 사용자 |
| 멤버 제거 | (Path) userId | 필수 |
| 소유자 이관 | targetUserId | 필수, 해당 WS의 WO 보유자 |
| 목록 | q / isActive / role / page / size / sort | 모두 선택, 기본 page=0/size=20/sort=createdAt,desc |

### 6.2 출력
| 구분 | 항목 | 설명 |
| --- | --- | --- |
| WS 표현 | id, name, description, isActive, ownerUser, memberCount, projectCount, createdAt | 공통 |
| 멤버 표현 | userId, email, name, roles[] | roles는 `WORKSPACE` scope의 Role 목록 |
| 응답 래퍼 | `success/code/message/data` | backend §4.5 |

## 7. 비즈니스 규칙
- **WS 생성은 WO만**, 본인 Company 컨텍스트에서 무제한 생성 가능(답 5 확정).
- **멤버 초대 = WS 진입(기본 Member)**. 단 `(userId, WORKSPACE, wsId)` 행이 이미 존재(CO 사전 부여)하면 그 Role 유지(INSERT ON CONFLICT DO NOTHING). Role 승격은 CO만(F-USER).
- **멤버는 같은 Company 사용자**만 가능. 다른 Company 사용자 초대 불가.
- **마지막 WO 보호**: 마지막 WO 1명 회수·제거 불가(`WS_LAST_WO_FORBIDDEN`).
- **CO는 모든 WS 가시·관리** 가능(본인 Company 내), 단 멤버 자체 초대는 WO만(권한 분리). CO는 사용자 Role 승격으로 멤버 가시화 가능.
- **비활성 WS 하위 격리**: 비활성 WS 내 Project·Suite·TC·Plan·Run·Defect 접근은 조회 포함 403 `WS_INACTIVE`(데이터는 보존).
- **격리키 보존**: `workspaces.company_id` 보유. 하위 도메인 테이블은 `company_id` + `workspace_id` 동시 보유.
- **물리 삭제 금지**: 비활성으로만 종결.

## 8. 예외 / 에러
| 상황 | 처리 | 에러 코드 |
| --- | --- | --- |
| 미인증 | 401 | `AUTH_UNAUTHORIZED` |
| WO 권한 부족 | 403 | `AUTH_FORBIDDEN` |
| CO 권한 부족 | 403 | `AUTH_FORBIDDEN` |
| 미존재 WS | 404 | `WS_NOT_FOUND` |
| 비활성 Company 내 WS 액션 | 403 | `COMPANY_INACTIVE` |
| 비활성 WS 액션 | 403 | `WS_INACTIVE` |
| 마지막 WO 회수/제거 | 400 | `WS_LAST_WO_FORBIDDEN` |
| 이관 대상이 해당 WS의 WO 아님 | 400 | `WS_TRANSFER_TARGET_NOT_WO` |
| 다른 Company 사용자 초대 시도 | 400 | `USER_NOT_IN_COMPANY` |
| 입력 형식 오류 | 400 | `COMMON_INVALID_INPUT` |

> 신규 코드(`WS_*`) backend `ErrorCode` enum 등록 필요.

## 9. 수용 기준 (Acceptance Criteria)
- [ ] **AC-1** Given WO 로그인, When 새 WS 생성하면, Then 200 + WS 생성 + `user_roles`에 `(요청자, WORKSPACE, wsId, WO)` 1행 추가.
- [ ] **AC-2** Given WO가 아닌 사용자, When WS 생성 시도하면, Then 403 `AUTH_FORBIDDEN`.
- [ ] **AC-3** Given CO, When `GET /workspaces` 호출하면, Then Company 내 전체 WS 목록을 받는다.
- [ ] **AC-4** Given Member, When `GET /workspaces` 호출하면, Then 본인이 멤버인 WS만 받는다.
- [ ] **AC-5** Given WO 로그인, When 같은 Company 사용자를 멤버 초대하면, Then `user_roles`에 `(userId, WORKSPACE, wsId, MEMBER)` 추가 (단 해당 행 이미 존재 시 기존 Role 유지).
- [ ] **AC-6** Given WO, When 다른 Company 사용자를 초대하면, Then 400 `USER_NOT_IN_COMPANY`.
- [ ] **AC-7** Given WS의 마지막 WO, When 제거/회수 시도하면, Then 400 `WS_LAST_WO_FORBIDDEN`.
- [ ] **AC-8** Given CO, When WS 비활성화하면, Then 그 WS 내 모든 도메인 API 호출이 403 `WS_INACTIVE`이다.
- [ ] **AC-9** Given 비활성 Company, When 그 안 WS API 호출하면, Then 403 `COMPANY_INACTIVE`(상위 비활성 우선).
- [ ] **AC-10** Given 다른 Company의 WS, When 접근하면, Then 404(은닉).
- [ ] **AC-11** Given CO, When WS 소유자를 다른 WO에게 이관하면, Then `owner_user_id` 변경, 기존 소유자 WO 권한 유지.
- [ ] **AC-12** Given WS 멤버 제거 후, When 그 사용자가 같은 WS의 Project에 접근하면, Then 격리 검증 단계에서 403 `AUTH_FORBIDDEN`(상위 WS 멤버십 사라짐).

## 10. 추적성
| Requirement ID | 설명 | 관련 기능/화면 | 관련 API(개념) | 연관 TestCase |
| --- | --- | --- | --- | --- |
| REQ-WS-001 | WO의 WS 생성(무제한) | /workspaces | `POST /workspaces` | (QA) |
| REQ-WS-002 | WS 목록 조회(Role 기반 가시 필터) | /workspaces | `GET /workspaces` | (QA) |
| REQ-WS-003 | WS 정보 수정 | /workspaces/{id}/settings | `POST /workspaces/{id}/update` | (QA) |
| REQ-WS-004 | WS 비활성/활성(CO) | /workspaces/{id}/settings | `POST /workspaces/{id}/(de)activate` | (QA) |
| REQ-WS-005 | WS 소유자 이관(CO) | /workspaces/{id}/settings | `POST /workspaces/{id}/transfer-ownership` | (QA) |
| REQ-WS-006 | WS 멤버 초대(WO, 기본 Member, 기존 Role 우선) | /workspaces/{id}/members | `POST /workspaces/{id}/members` | (QA) |
| REQ-WS-007 | WS 멤버 제거 | /workspaces/{id}/members | `POST /workspaces/{id}/members/{userId}/remove` | (QA) |
| REQ-WS-008 | 마지막 WO 보호 | 전역 | (서비스 규칙) | (QA) |
| REQ-WS-009 | 비활성 WS 격리 차단 | 전역 | (격리 필터) | (QA) |

## 11. 오픈 이슈 / 비고
- **WS 이름 회사 내 unique 여부**: 권장 unique vs 자유. 데모는 권장 unique(중복 시 경고 토스트). 운영은 Phase 2 결정.
- **멤버 제거 시 하위 Project 멤버십 처리**: 현재 룰은 "자동 삭제 X, 격리 차단으로 차단". WS 재초대 시 Project Role 복구 vs 신규 부여 여부 — Phase 2 결정.
- **WS 알림**: 초대받은 사용자 인앱/메일 알림은 Phase 2 F-NOTIFY.
- **WS 단위 데이터 export/이관**: Phase 2.
- **CO 본인이 WO 부여 받지 않은 WS의 상세 조회 시 보이는 멤버 목록 범위**: 데모는 멤버 메타(이름·이메일·Role)까지 노출. 운영 정책은 Phase 2.
