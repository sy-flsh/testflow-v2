# [UX] 사용자 Role 매트릭스 화면 (CO 전용)

| 항목 | 내용 |
| --- | --- |
| 문서 종류 | UX/화면 명세 (기능 명세 보조) |
| 부속 기능 | F-USER §5.3 |
| 상태 | 검토 |
| Figma | https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=0-1&p=f&m=dev |
| 작성자 | 기능 기획자 에이전트 |
| 최종 수정일 | 2026-06-05 |

> 본 문서는 **CO가 한 사용자에 대해 (Workspace, Project)별 Role을 부여·회수**하는 매트릭스 화면을 정의한다. 기능적 흐름·에러·AC는 [04-user.md](04-user.md) §5.3을 정본으로 하며, 본 문서는 **레이아웃·상호작용·상태 표시**에 집중한다.

## 1. 진입 경로
- `/company/users/{userId}` → 상단 탭 `[프로필]` `[권한 매트릭스]` 중 `[권한 매트릭스]` 선택.
- 사이드바 "사용자 관리" → 사용자 선택 → 매트릭스 탭.

## 2. 화면 구성

### 2.1 헤더
```
[← 사용자 목록]   김OO (kim@acme.com)         [저장]   [취소]
                  활성 · 가입 2026-04-01
```
- 우측 [저장] [취소] 버튼은 변경 사항이 있을 때만 활성.
- 변경 사항 없으면 [저장] 비활성.

### 2.2 Company 행 (최상단)
```
COMPANY  Acme Corp
   [✓ CO]   (Company 전체 관리 권한)
```
- 단일 체크박스 `CO`.
- 본인 CO인 경우(자기 자신 화면일 때) 회수 체크 해제 시 경고 `본인 CO 권한 회수 불가 (다른 CO가 회수해야 함)`.

### 2.3 Workspace 섹션 (Company 행 아래)
- 사용자가 멤버인 WS만 노출. CO가 WS 추가 부여 시 "+ Workspace 추가" 버튼 → 모달에서 WS 선택 → 기본 Member 행 추가.
- 각 WS 행:
```
WORKSPACE  Frontend Team                            [WS 제거]
   ( ) WO   (•) Member   ( ) Viewer
   └ PROJECTS  ▼ 펼치기
```
- "WS 제거" = WS 멤버십 자체 제거(`scope_type=WORKSPACE` 전 Role 회수). 마지막 WO 시도 시 토스트 `마지막 WO는 회수 불가`.
- **3개 라디오** (WO/Member/Viewer) — WS 1건당 단일 Role. WO는 WS 관리 권한, Member는 기본 진입(자산 작업은 Project Scope Role 필요), Viewer는 CO 강등용.

### 2.4 Project 서브섹션 (각 WS 아래 펼치기)
```
└ PROJECTS
    □ Project A     ( ) PO   ( ) Member   (•) Viewer    [Project 제거]
    □ Project B     (•) PO   ( ) Member   ( ) Viewer    [Project 제거]
    + Project 추가
```
- 각 Project 1줄. **3개 라디오**(PO/Member/Viewer) — Project 1건당 단일 Role만 허용(MVP 권장).
- 좌측 체크박스(`□`)는 "이 Project에서 멤버 제거". 체크 해제 시 그 Project Scope의 모든 Role 회수.
- "+ Project 추가" → 모달에서 같은 WS 내 Project 선택 → 기본 Member로 행 추가.

### 2.5 변경 사항 미리보기 (Sticky 하단 패널)
```
변경 사항: 3건 추가, 1건 회수
+ Workspace Frontend Team에서 WO 부여
+ Project A에서 Viewer 부여
+ Project B에서 PO 부여
- Workspace Backend Team에서 WO 회수

[취소] [저장]
```
- 저장 → `POST /api/v1/company/users/{userId}/roles/grant`·`/revoke` 단일 트랜잭션 호출.
- 실패 시 패널 상단에 에러 `code` + 메시지 표시. 모든 변경 롤백.

## 3. 상호작용 룰

### 3.1 즉시 저장 X / 일괄 저장
- 모든 변경은 **로컬 상태만**. [저장] 클릭 시점에 1회 트랜잭션 전송.
- 사용자가 새로고침/페이지 이탈 시 미저장 경고 다이얼로그.

### 3.2 Role 변경 유형
- 라디오 변경 = (기존 Role 회수 + 신규 Role 부여). 서버에 2개 작업으로 전달.
- 체크박스 해제 = 그 Scope의 모든 Role 회수.

### 3.3 Scope 일관성
- WO/Member/Viewer는 Workspace 행에, PO/Member/Viewer는 Project 행에 표시. (Member/Viewer는 양쪽 Scope 모두 부여 가능)
- 시스템이 UI 단계에서 Scope 위반을 막아 `USER_INVALID_ROLE_SCOPE`(서버) 발생 최소화.

### 3.4 시스템 잠금 방지 (즉시 UI 차단)
- 마지막 CO 본인 회수 시도 → 체크박스 해제 직후 토스트 `본인 CO 권한 회수 불가`. 자동 재선택.
- 시스템 단일 CO 회수(=Company 마지막 CO) → 동일 토스트 `Company 마지막 CO는 회수 불가`.
- 마지막 WO/PO 회수 시도 → 동일 패턴.
- 비활성 사용자에 부여 시도 → 행 자체 회색 처리 + 툴팁 `비활성 사용자에게 부여 불가`.
- 비활성 WS/Project 행 → 회색 + "비활성" 뱃지 + 편집 비활성.

### 3.5 검색·정렬
- WS 다수일 때 상단 검색바 `WS 검색`.
- Project 다수일 때 WS 행 내 `Project 검색`.

## 4. 상태 표시

### 4.1 변경 상태 색상
- 추가(녹색 좌측 점), 회수(빨강 좌측 점), 변경 없음(중립).
- 저장 후 색상 리셋.

### 4.2 로딩
- 저장 중 [저장] 비활성 + 스피너. 전역 차단 없음.
- 초기 로딩 시 영역별 스켈레톤.

### 4.3 빈 상태
- WS 0개: 안내 텍스트 `이 사용자는 어떤 Workspace에도 소속되지 않았습니다. "Workspace 추가"로 시작.`
- Project 0개 (WS 내): 안내 텍스트 + "+ Project 추가" CTA.

### 4.4 권한 외 사용자 진입
- CO 외 사용자가 본 화면 진입 → 403 토스트 + `/me` 또는 안전 경로 리다이렉트(SRS §6.3).

## 5. 접근성 / 단축키 (MVP 한정)
- 키보드 탭 이동 지원.
- 라디오는 `Enter`/`Space`로 선택.
- 저장은 `Ctrl/Cmd + S`.
- 스크린리더 ARIA 라벨은 MVP 최소(접근성 풀스코프 Phase 2 — SRS §3.4).

## 6. API 연동 요약 (F-USER §5.3 정본 참조)
| UI 동작 | API |
| --- | --- |
| 화면 진입 | `GET /api/v1/company/users/{userId}` (rolesByScope 포함) |
| WS 후보 모달 | `GET /api/v1/workspaces?role=WO|MEMBER|VIEWER` (사용자가 미멤버인 WS 후보) |
| Project 후보 모달 | `GET /api/v1/workspaces/{wsId}/projects` (현 WS Project 후보) |
| 저장 | `POST /api/v1/company/users/{userId}/roles/sync` (단일 호출, body: `{grants: [...], revokes: [...]}`, 트랜잭션 + 멱등) |

> **확정**: 서버에 **단일 엔드포인트** `POST /api/v1/company/users/{userId}/roles/sync` (body: `{grants: [...], revokes: [...]}`) 도입. 묶음 트랜잭션 + 멱등 처리. F-USER §5.3 정본 반영 완료(2026-06-08).

## 7. 오픈 이슈
- **Project당 다중 Role 허용 여부**: F-PROJ §11 오픈이슈와 동일. MVP UI는 단일 라디오 강제. 다중 부여 시 라디오 → 체크박스 그룹으로 변경 필요.
- **CO 화면에서 본인 자기 매트릭스 진입 시 추가 가드**: 본인 CO 회수 차단 외, 본인 비활성 시도도 차단 (F-USER §7).
- **사용자 다수 일괄 부여(Bulk)**: 여러 사용자 선택 후 같은 Role 일괄 부여 — Phase 2.
- **변경 이력(감사)**: 누가 언제 어떤 Role을 부여/회수했는지 — Phase 2 F-AUDIT.
- **검색·필터 고도화**: WS·Project 다수일 때 페이지네이션 — Phase 2.
