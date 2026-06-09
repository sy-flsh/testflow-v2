# TMS 권한 매트릭스 (Permission Matrix)

| 항목 | 내용 |
| --- | --- |
| 문서명 | TMS 권한 매트릭스 부록 |
| 문서 버전 | v0.2 |
| 작성일 | 2026-06-05 (최종 갱신 2026-06-09) |
| 작성 주체 | PM |
| 문서 등급 | 정본 — Role × Action × Scope 권한 정본 |
| 적용 범위 | Backend(`@PreAuthorize`/서비스 권한 분기), Frontend(메뉴/버튼 표시), QA(AC 권한 케이스) |
| Figma | https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=0-1&p=f&m=dev |
| 부모 문서 | [`srs.md`](srs.md) §1.3, §3.2, §4.4 |

> 본 문서는 SRS의 권한 모델을 **Action 단위 매트릭스**로 구체화한다. 기능 명세(`features/*`)와 충돌 시 본 문서가 권한 정의에 한해 우선한다.

---

## 1. 권한 부여 모델

- **(User × Scope) 다중 부여**. 한 사용자는 여러 Scope에서 서로 다른 Role을 동시 보유한다.
- **부여자 단일**: 일반 사용자(WO/PO/Member/Viewer)의 Role 부여·승격은 **CO만 가능**. WO/PO는 멤버 초대(Scope 진입)만 가능하며, CO가 부여한 Role이 있으면 그대로 유지된다.
  - WO의 WS 멤버 초대 시 기본 Role은 **Member** (CO가 해당 Scope에 사전 부여한 Role이 없을 때). CO가 이미 부여한 Role이 있으면 그 Role 유지.
  - PO의 Project 멤버 초대 시 기본 Role은 **Member** (CO가 해당 Scope에 사전 부여한 Role이 없을 때). CO가 이미 부여한 Role이 있으면 그 Role 유지.
- **Master는 사용자 Role 부여 불가**. 시스템 전역 작업(Company 생성/비활성)만 가능.

## 2. Scope 정의

| Scope | 부여 단위 | 식별 |
| --- | --- | --- |
| SYSTEM | 시스템 전역 | (없음) |
| COMPANY | 단일 Company | `company_id` |
| WORKSPACE | 단일 Workspace | `(company_id, workspace_id)` |
| PROJECT | 단일 Project | `(company_id, workspace_id, project_id)` |

> `user_roles.scope_type` enum: `COMPANY`/`WORKSPACE`/`PROJECT`. `SYSTEM`은 `master_admins` 테이블 소속으로 표현(별도 `user_roles` 행 없음).

## 3. Role 정의

| Role | 적용 Scope | 한 사용자가 동시 보유 개수 | 비고 |
| --- | --- | --- | --- |
| Master | SYSTEM | 1 (시스템 전역) | `master_admins` 테이블 |
| CO | COMPANY | 1 (본인 소속 Company) | Company당 N명 |
| WO | WORKSPACE | N (여러 WS에서 각각 WO 가능) | CO 승격으로만 부여 |
| PO | PROJECT | N | CO 승격으로만 부여 |
| Member | WORKSPACE + PROJECT | N | WS·Project 초대 시 기본 Role. Project 생성해도 Member 유지 |
| Viewer | WORKSPACE + PROJECT | N | CO 부여 전용 (Member에서 강등 시). 초대 기본 Role 아님 |

> **상위 Scope의 Role은 하위 Scope의 권한을 포함하지 않는다.** 예: CO는 자동으로 WO·PO가 아니다(별도 `user_roles` 행 필요). 단, CO는 Role **부여 권한**과 **조회 권한**을 가진다(§4 매트릭스).

## 4. 권한 매트릭스 (Action × Role)

`✓` = 허용 / `-` = 불가 / `★` = 조건부 (조건은 §5 명시)

### 4.1 시스템 / Company

| Action | Master | CO | WO | PO | Member | Viewer |
| --- | --- | --- | --- | --- | --- | --- |
| Company 생성 (Master 등록 경로) | ✓ | - | - | - | - | - |
| Company 생성 (셀프 가입 경로) | - | ★1 | - | - | - | - |
| Company 비활성/활성 | ✓ | - | - | - | - | - |
| 전역 Company 목록 조회 | ✓ | - | - | - | - | - |
| 본인 Company 정보 조회 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 본인 Company 정보 수정(이름·slug 등) | - | ✓ | - | - | - | - |
| Company 소유자 이관(주 CO 변경) | - | ✓ ★2 | - | - | - | - |
| 다른 사용자에게 CO 권한 부여 | - | ✓ | - | - | - | - |
| 본인 Company 내 사용자 전체 조회 | - | ✓ | - | - | - | - |

★1: 셀프 가입 시 신규 Company 자동 생성, 본인이 첫 CO. 회원가입 동작이므로 "권한"이라기보다 흐름.
★2: 자기 자신이 마지막 CO인 경우 이관 후에야 본인 CO 권한 해제 가능. **마지막 CO 비활성/탈퇴 불가**.

### 4.2 Workspace

> **본 절 Member·Viewer 컬럼 = WORKSPACE Scope 부여 기준** (`(userId, WORKSPACE, wsId, Member|Viewer)` 행 보유자). Project Scope만 보유한 사용자(PO/Member(Proj)/Viewer(Proj))의 상위 WS 가시는 ★22 참조.

| Action | Master | CO | WO | Member(WS) | Viewer(WS) |
| --- | --- | --- | --- | --- | --- |
| WS 생성 | - | - | ✓ | - | - |
| Company 내 WS 목록 조회 | ✓ ★3 | ✓ | ✓ ★4 | ✓ ★4 | ✓ ★4 |
| WS 정보 수정(이름 등) | - | ✓ | ✓ ★5 | - | - |
| WS 비활성/활성 | - | ✓ | - | - | - |
| WS 소유자 이관(주 WO 변경) | - | ✓ | - | - | - |
| WS 멤버 초대 | - | - | ✓ ★5 | - | - |
| WS 멤버 목록 조회 | - | ✓ | ✓ ★5 | ✓ ★6 | ✓ ★6 |
| WS 멤버 제거 | - | ✓ | ✓ ★5 | - | - |

★3: 전체 Company의 모든 WS를 본다는 의미가 아니라, 시스템 관리상 필요한 메타 조회만(데모에서는 미구현 가능).
★4: 본인이 WS Scope user_roles 행 보유한 WS만 노출. ★22 자동 가시도 포함.
★5: WO는 본인이 소유 또는 멤버인 WS에 한정.
★6: 본인이 WS Scope user_roles 행 보유한 WS 한정.

### 4.3 Project

> **본 절 Member·Viewer 컬럼 = PROJECT Scope 부여 기준** (`(userId, PROJECT, projId, Member|Viewer)` 행 보유자). WS Scope만 보유한 사용자(Member(WS)/Viewer(WS))의 하위 Project 가시는 ★23 참조.

| Action | Master | CO | WO | PO | Member(Proj) | Viewer(Proj) |
| --- | --- | --- | --- | --- | --- | --- |
| Project 생성 | - | - | ✓ ★15 | ✓ ★7 | ✓ ★8 | - |
| Project 목록 조회 | - | ✓ | ✓ ★5 | ✓ ★9 | ✓ ★9 | ✓ ★9 |
| Project 정보 수정(이름·설명) | - | ✓ | ✓ ★15 | ✓ ★9 | - | - |
| Project 비활성/활성 | - | ✓ | ✓ ★15 | ✓ ★9 | - | - |
| Project 멤버 초대 | - | - | - | ✓ ★9 | - | - |
| Project 멤버 목록 조회 | - | ✓ | ✓ ★5 | ✓ ★9 | ✓ ★9 | ✓ ★9 |
| Project 멤버 제거 | - | - | - | ✓ ★9 | - | - |

★7: PO는 본인이 PO인 Project가 속한 WS에서 신규 Project 생성 가능. WS 진입은 WO 초대로.
★8: Member는 본인이 멤버인 WS에서 신규 Project 생성 가능. **Member가 생성한 Project에서도 Role은 Member 유지** (PO 자동 승격 X). Member의 Project 생성은 무제한 (제한 룰 없음 — 답 7 확정).
★9: 본인이 멤버인 Project 한정.
★15: **WO 한정 — 본인이 WO 또는 멤버 Role을 보유한 WS의 Project**. Project 자체에 별도 Scope Role 부여 없이도 Project 컨테이너 수준(생성·이름·설명·활성) 관리 가능. 단 Project 내부 자산(Suite/TC/Plan/Run/Defect/Attachment) 작업·멤버 초대는 별도 PO/Member Role 필요. WO는 자산 트리만 자동 가시(read).

> **WO ★9 셀(Suite/Plan/Attachment 쓰기)의 의미** — WO 컬럼에 `★9`가 표기된 액션은 "WO이면서 동시에 해당 Project Scope Role(PO/Member)을 보유한 경우"에만 허용된다. 순수 WO(Project Scope Role 없음)는 ★15에 따라 read 한정. 이중 Role 보유 시 WO 권한과 Project 멤버 권한이 합집합으로 적용된다.

### 4.4 TestSuite / TestCase / TestPlan / TestRun / Defect / Attachment / Report

> **본 절 Member·Viewer 컬럼 = PROJECT Scope 부여 기준** (자산 작업은 모두 Project Scope). WS Scope Member·Viewer는 자산 작업 불가(★19). TC 생성 Workspace Scope 행은 작업 Scope를 의미하며 컬럼은 사용자 Role 기준.

| Action | Master | CO | WO | PO | Member(Proj) | Viewer(Proj) |
| --- | --- | --- | --- | --- | --- | --- |
| Suite 트리 조회 | - | - | ✓ ★15 (read) | ✓ ★9 | ✓ ★9 | ✓ ★9 |
| Suite 생성·수정·이동 | - | - | ✓ ★9 | ✓ ★9 | ✓ ★9 | - |
| Suite 삭제 (Soft) | - | - | ✓ ★9 | ✓ ★16 | ✓ ★16 | - |
| TestCase 조회 | - | - | ✓ ★15 (read) | ✓ ★9·★17 | ✓ ★9·★17 | ✓ ★9·★17 |
| **TC 생성 — Global Scope** | ✓ | - | ✓ | ✓ | ✓ | ✓ ★18 |
| **TC 생성 — Workspace Scope** | - | - | ✓ ★5 | ✓ ★5 | ✓ ★5 | ✓ ★5·★18 |
| **TC 생성 — Project Scope** | - | - | - | ✓ ★9 | ✓ ★9 | - |
| TC 수정 | - | - | - | ✓ ★17 | ✓ ★17 | - |
| TC 삭제 (Soft) | - | - | - | ✓ ★16·★17 | ✓ ★16·★17 | - |
| TestPlan 조회 | - | - | ✓ ★9 | ✓ ★9 | ✓ ★9 | ✓ ★9 |
| TestPlan 생성·수정 | - | - | ✓ ★9 | ✓ ★9 | ✓ ★9 | - |
| TestPlan 삭제 (Soft) | - | - | ✓ ★16 | ✓ ★16 | ✓ ★16 | - |
| PlanItem 할당(담당자 지정) | - | - | ✓ ★9 | ✓ ★9 | ✓ ★9 | - |
| TestRun 기록(단계별 결과 입력) | - | - | - | ✓ ★9 | ✓ ★9 ★10 | - |
| TestRun 조회 | - | - | - | ✓ ★9 | ✓ ★9 | ✓ ★9 |
| TestRun 삭제 (Soft) | - | - | - | ✓ ★16 | ✓ ★16 | - |
| Defect 등록 | - | - | - | ✓ ★9 | ✓ ★9 | - |
| Defect 조회 | - | - | - | ✓ ★9 | ✓ ★9 | ✓ ★9 |
| Defect 상태 변경 | - | - | - | ✓ ★9 | ✓ ★9 ★11 | - |
| Defect 담당자 변경 | - | - | - | ✓ ★9 | - | - |
| Defect 삭제 (Soft) | - | - | - | ✓ ★16 | ✓ ★16 | - |
| Attachment 업로드 | - | - | ✓ ★9 | ✓ ★9 | ✓ ★9 | - |
| Attachment 조회·다운로드 | - | - | ✓ ★9 | ✓ ★9 | ✓ ★9 | ✓ ★9 |
| Attachment 삭제 (Soft) | - | - | ✓ ★16 | ✓ ★16 | ✓ ★16 | ✓ ★9 |
| Report 조회 | - | - | ✓ ★9 | ✓ ★9 | ✓ ★9 | ✓ ★9 |

★10: Member는 본인이 할당받은 PlanItem만 결과 기록 가능. 비할당 PlanItem은 PO가 할당해야 기록 가능.
★11: Member는 본인이 등록 또는 담당자로 할당받은 Defect의 상태만 변경 가능.
★16: **소유자 한정 삭제(MVP)** — `created_by = 요청자`인 경우만 soft delete. 다른 Role(PO/CO/WO 등) 우회 권한 없음. Phase 2 승인 단계 도입 시 확장. (기획자 doc Rule 1)
★17: **TestCase Scope 가시·작업 범위** — Project Scope TC는 그 Project 멤버만, Workspace Scope TC는 그 WS 멤버만, Global Scope TC는 Company 내 모든 사용자. 수정은 작성자 외에도 같은 Scope 멤버 허용(MVP). 삭제는 ★16 작성자 한정.
★18: **Viewer의 TC 생성** — 답 3 확정: Global TC는 모든 권한 사용자 생성 가능 (Viewer 포함). Workspace TC도 동일하게 WS 멤버라면 누구나(Viewer 포함). Project TC만 Viewer 제외(기존 룰 유지). Phase 2 승인 단계로 거버넌스 강화 예정.

★19: **§4.4 Member 컬럼은 Project Scope 부여 기준**. WS Scope `Member`는 WS 진입·메뉴 가시·본인 멤버 WS의 Project 목록 조회까지만 허용한다. 자산 작업(Suite/TC/Plan/Run/Defect/Attachment)·Project 생성·Project 멤버 초대는 별도 Project Scope Role(Member/PO) 필요. WS Scope `Member`는 WO와 달리 WS 관리(이름 수정·멤버 초대·Project 생성) 권한 없음.

★20: **초대 기본 Role 정책 — Member**. WO의 WS 초대 / PO의 Project 초대 시 신규 `user_roles` 행의 기본 Role은 **Member**. 단 해당 `(user_id, scope_type, scope_id)` 행이 이미 존재하면(CO가 사전에 다른 Role 부여) 그 Role 유지(INSERT ON CONFLICT DO NOTHING). Role 승격은 CO만(§4.5).

★22: **Project Scope 사용자의 상위 WS 자동 가시** — PO/Member(Proj)/Viewer(Proj)는 본인이 멤버인 Project가 속한 WS의 정보·목록 자동 조회 가능(별도 WS Scope `user_roles` 행 없어도 OK). 단 WS 정보 수정·멤버 초대·소유자 이관 등 WS 관리 액션은 불가(WO/CO 한정).

★23: **WS Scope Member의 하위 Project 자동 가시** — Member(WS)/Viewer(WS)는 본인 WS 내 모든 Project 목록·상세 자동 조회 가능. 단 Project 내부 자산 작업·멤버 초대는 Project Scope Role 별도 필요(§4.4 ★19).

### 4.5 사용자 관리

| Action | Master | CO | WO | PO | Member | Viewer |
| --- | --- | --- | --- | --- | --- | --- |
| Company 사용자 초대(이메일 발송) | - | ✓ | - | - | - | - |
| Company 사용자 탈퇴(soft) | - | ✓ | - | - | - | - |
| 임시 비번 리셋(다른 사용자) | - | ✓ | - | - | - | - |
| Company 내 사용자 전체 조회 | - | ✓ | - | - | - | - |
| 다른 사용자의 Scope×Role 부여 | - | ✓ ★12 | - | - | - | - |
| 다른 사용자의 Scope×Role 회수 | - | ✓ ★12 | - | - | - | - |
| WS 멤버 초대(WS 진입) | - | - | ✓ ★5 | - | - | - |
| Project 멤버 초대(Project 진입) | - | - | - | ✓ ★9 | - | - |

★12: 부여 단위는 `(scope_type, scope_id, role)` 1행. CO는 본인 Company 내 모든 Scope에 대해 부여·회수 가능.

### 4.6 본인 (Self)

| Action | Master | CO | WO | PO | Member | Viewer |
| --- | --- | --- | --- | --- | --- | --- |
| 본인 프로필 조회 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 본인 정보 수정(이름) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 본인 비밀번호 변경 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 본인 활성/비활성 변경(차단) | - | ✓ | - | - | - | - |
| 본인 탈퇴 | - | ★2 | - | - | - | - |

---

## 5. 시스템 잠금 방지 규칙

| 규칙 | 사유 | 에러 코드(권장) |
| --- | --- | --- |
| 마지막 Master 비활성/삭제 불가 | 시스템 잠금 방지 | `MASTER_LAST_FORBIDDEN` |
| 마지막 CO 강등/비활성/탈퇴 불가 (소유자 이관 후에만 가능) | Company 잠금 방지 | `COMPANY_LAST_CO_FORBIDDEN` |
| CO 본인이 본인의 CO Role 회수 불가 (다른 CO가 회수해야 함) | 자기탈권 방지 | `USER_SELF_CO_REVOKE_FORBIDDEN` |
| 마지막 WO 강등 불가 (소유자 이관 후) | WS 잠금 방지 | `WS_LAST_WO_FORBIDDEN` |
| 마지막 PO 강등 불가 (소유자 이관 후) | Project 잠금 방지 | `PROJ_LAST_PO_FORBIDDEN` |
| 비활성 Company/WS/Project 하위 모든 액션 차단 (조회 외) | 격리 무결성 | `*_INACTIVE` |
| 다른 Company의 자원 접근 시도 | 격리 위반 | `404` 은닉 |

---

## 6. 구현 가이드

### 6.1 백엔드
- `user_roles` 조회 캐시는 요청 스코프 또는 짧은 TTL(예: 30초) Redis 캐시. Role 변경 시 즉시 무효화.
- `@PreAuthorize`로 Action 진입 전 1차 분기, 서비스 레이어에서 Scope 격리·상세 조건(★ 항목) 2차 검증.
- 격리 자동 필터(backend §7.5)는 `company_id/workspace_id/project_id`까지 적용. Role 매트릭스와 분리.

### 6.2 프론트엔드
- 컨텍스트(`companyId/workspaceId/projectId`) 변경 시 사용자의 현재 Scope Role을 서버에 재조회 → 메뉴/버튼 가시성 결정.
- 버튼은 권한 없으면 **숨김 우선** (회색 비활성 X — 노이즈 방지).
- URL 직접 진입으로 권한 미보유 화면 도달 시 403 토스트 + 상위 안전 경로 리다이렉트(SRS §6.3).

### 6.3 QA
- 각 ★ 조건별 AC 작성 필수 (특히 ★9 본인 멤버 한정, ★10/11 본인 할당/소유 한정).
- 시스템 잠금 방지 5종 각각 AC 1건 이상.
- 격리 위반(타 Company/WS/Project 자원 직접 접근) AC 각 도메인에 1건.

---

## 7. 변경 이력

| 버전 | 일자 | 변경 내용 | 작성자 |
| --- | --- | --- | --- |
| v0.1 | 2026-06-05 | 최초 작성. 6 Role × 4 Scope 매트릭스, 시스템 잠금 방지 7종, ★ 조건 12종 | PM 에이전트 |
| v0.2 | 2026-06-09 | `TMS_권한매트릭스_v2.xlsx` 동기화. **변경 셀:** (1) Project 정보 수정 CO=✓ 추가, (2) Suite 생성·수정·이동 WO=★9 추가, (3) Suite 삭제 WO=★9 추가, (4) TC 생성 Global Scope CO=— (CO 제외), (5) TC 생성 Workspace Scope CO=— (CO 제외), (6) TestPlan 조회 WO=★9 추가, (7) TestPlan 생성·수정 WO=★9·Member=★9 추가, (8) TestPlan 삭제 WO=★16 추가, (9) PlanItem 할당 WO=★9·Member=★9 추가, (10) Attachment 업로드 WO=★9 추가, (11) Attachment 조회·다운로드 WO=★9 추가, (12) Attachment 삭제 WO=★16·Viewer=★9 추가, (13) Report 조회 WO=★9 추가, (14) 본인 활성/비활성 CO=✓ 추가. ★15 보조 노트 추가(WO ★9 셀 = WO+Project Scope Role 합집합 의미). | PM 에이전트 |
