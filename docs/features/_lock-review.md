# 기능 명세 락 리뷰 트래커 (P0)

> **목적**: 12 feature + 2 UX 명세를 `검토 → 확정`으로 락하기 위한 PM 리뷰 진행 상황 추적. 락 미수행 시 BE/FE 동시 드리프트 발생.
>
> **기간**: 2026-06-08 ~ 2026-06-12 (1주)
> **사인오프 주체**: PM
> **락 결과 반영**: `README.md` 상태 컬럼 일괄 전환 + 락 이력 v2.3 추가

---

## 락 기준 (Definition of Locked)

각 feature 명세가 다음을 모두 충족해야 `확정` 전환:

1. **백로그 정합**: `README.md` MVP 12기능 표의 도메인/Role/회원가입 경로와 일치
2. **횡단 규칙 정합**: SRS §4(3-tier 격리키), §6(공통 패턴), `permissions.md`, `glossary.md` 용어와 일치
3. **수용 기준(AC) 완비**: 각 기능별 AC가 테스트 가능한 형태로 명세됨
4. **에러/상태 enum 명시**: 상태 머신·에러 코드·enum 값 명시 (backend-standard 정합)
5. **UI 표현 패턴 정합**: 모달/사이드바/새화면 룰 (frontend-standard) 일치
6. **추적성 ID 부여**: `REQ-<도메인>-NNN` 부여 완료
7. **PM 사인오프**: 본 트래커 사인오프 컬럼 ✅

미충족 항목은 **수정 PR 1건** 단위로 처리.

---

## 도메인 묶음 리뷰 순서

| 라운드 | 묶음 | 대상 | 권장 검토일 |
|---|---|---|---|
| R1 | Org/Auth | F-COMPANY, F-WS, F-AUTH, F-USER (+UX 2) | D+0 ~ D+1 |
| R2 | Project/Test | F-PROJ, F-TS, F-TC, F-PLAN, F-RUN, F-DEF | D+1 ~ D+3 |
| R3 | Common | F-ATTACH, F-REPORT | D+3 ~ D+4 |
| 락 | 일괄 사인오프 | 12 feature + 2 UX 상태 전환 | D+4 ~ D+5 |

---

## R1 — Org/Auth 묶음

| ID | 파일 | 라인 | 리뷰어 | 검토 시작 | 피드백 건수 | 수정 PR | 사인오프 |
|----|------|------|--------|----------|------------|--------|---------|
| F-COMPANY | [01-company.md](01-company.md) | 178 | PM | ⬜ | - | - | ⬜ |
| F-WS | [02-workspace.md](02-workspace.md) | 176 | PM | ⬜ | - | - | ⬜ |
| F-AUTH | [03-authentication.md](03-authentication.md) | 235 | PM | ⬜ | - | - | ⬜ |
| F-USER | [04-user.md](04-user.md) | 219 | PM | ⬜ | - | - | ⬜ |
| UX-USER | [_ux-user-detail.md](_ux-user-detail.md) | 217 | PM+FE | ⬜ | - | - | ⬜ |
| UX-ROLE | [_ux-role-matrix.md](_ux-role-matrix.md) | 134 | PM+FE | ⬜ | - | - | ⬜ |

### R1 중점 확인 사항
- 회원가입 2경로(A·B·C) + SMTP 의존
- Role 6단 정의 + Scope 매핑 (`permissions.md` 매트릭스 정합)
- WO Project 컨테이너 권한 ★15
- Role 매트릭스 사이드바 탭 UX 정합

### R1 피드백 로그
> 형식: `- [YYYY-MM-DD] {ID} {파일:라인} — 코멘트 — {액션/담당}`

(작성 대기)

---

## R2 — Project/Test 묶음

| ID | 파일 | 라인 | 리뷰어 | 검토 시작 | 피드백 건수 | 수정 PR | 사인오프 |
|----|------|------|--------|----------|------------|--------|---------|
| F-PROJ | [05-project.md](05-project.md) | 187 | PM | ⬜ | - | - | ⬜ |
| F-TS | [06-test-suite.md](06-test-suite.md) | 145 | PM | ⬜ | - | - | ⬜ |
| F-TC | [07-test-case.md](07-test-case.md) | 246 | PM | ⬜ | - | - | ⬜ |
| F-PLAN | [08-test-plan.md](08-test-plan.md) | 163 | PM | ⬜ | - | - | ⬜ |
| F-RUN | [09-test-run.md](09-test-run.md) | 227 | PM | ⬜ | - | - | ⬜ |
| F-DEF | [10-defect.md](10-defect.md) | 186 | PM | ⬜ | - | - | ⬜ |

### R2 중점 확인 사항
- Project `code` 불변·Company unique
- 테스트 도메인 5룰 (README v2.2 락):
  1. 삭제 작성자 한정 (★16)
  2. TestRun 단계별 결과 + 자동 종료 + 소요시간
  3. TestCase Scope 3종 (Global/Workspace/Project)
  4·5. TC 변경 시 영향 Run UNTESTED + step 이력 + duration 보존
- ExecutionResult enum 5종 (UNTESTED 활성)
- TestRun status enum (IN_PROGRESS / COMPLETED)

### R2 피드백 로그

(작성 대기)

---

## R3 — Common 묶음

| ID | 파일 | 라인 | 리뷰어 | 검토 시작 | 피드백 건수 | 수정 PR | 사인오프 |
|----|------|------|--------|----------|------------|--------|---------|
| F-ATTACH | [11-attachment.md](11-attachment.md) | 149 | PM | ⬜ | - | - | ⬜ |
| F-REPORT | [12-report.md](12-report.md) | 142 | PM | ⬜ | - | - | ⬜ |

### R3 중점 확인 사항
- 이미지 단일 첨부 / 로컬 디스크 / 사이즈 제한 / MIME 검증
- 최소 리포트 지표 (Pass율, 결함 카운트) 산식 + Scope 적용

### R3 피드백 로그

(작성 대기)

---

## 락 사인오프 (최종)

| 단계 | 담당 | 일자 | 결과 |
|---|---|---|---|
| 전 12 feature + 2 UX 사인오프 완료 확인 | PM | ⬜ | - |
| 락 적용 스크립트 실행 (`scripts/apply-lock.sh <YYYY-MM-DD>`) | PM | ⬜ | - |
| `git diff` 검토 (README 변경 + all-specs.md 갱신) | PM | ⬜ | - |
| 락 PR 생성·머지 | PM | ⬜ | - |
| spec-drift CI 통과 확인 | CI | ⬜ | - |
| 락 공지 (BE/FE/DBA 에이전트 입력 반영) | PM | ⬜ | - |

### 락 적용 명령 (사인오프 완료 후 1회 실행)

```bash
# 1) 락 변경 일괄 적용
./scripts/apply-lock.sh 2026-06-12

# 2) diff 검토
git diff docs/features/README.md docs/all-specs.md

# 3) 커밋 + PR
git add docs/features/README.md docs/all-specs.md
git commit -m "docs(features): lock 12 features + 2 UX (v2.3, 2026-06-12)"
git push origin HEAD
# gh pr create --title "docs: lock 12 features + 2 UX (v2.3)" --body "..."
```

스크립트 동작:
1. README 12 feature 행 + 2 UX 행 `검토 → 확정` 치환
2. MVP 스코프 헤더에 `본문 락 YYYY-MM-DD` 태그 추가
3. 락 이력 표에 `v2.3` 행 추가
4. `gen-all-specs.sh` 자동 호출로 합본 갱신
5. 멱등 — 재실행 시 v2.3 행 중복 추가 없음

---

## 락 후 변경 절차 (drift 방지)

락 이후 명세 변경은 **RFC 절차** 필수:

1. RFC 이슈 작성 (변경 사유·영향·테스트 임팩트)
2. PM 승인
3. 명세 PR (해당 feature 파일 + 영향 받는 SRS/glossary/permissions)
4. pre-commit hook이 `all-specs.md` 자동 갱신
5. 다운스트림 에이전트(BE/FE/DBA/Test)에 변경 알림

---

## 락 v2.7 (2026-06-09) — WS·Project 초대 정책

> 본 락은 v2.5 본문 사인오프 이후 RFC 절차로 진행된 P1 후속 변경.

### 변경 요약
1. **초대 기본 Role = Member** (기존 Viewer 폐기). WO의 WS 초대 / PO의 Project 초대 양쪽 적용.
2. **CO 사전 부여 Role 보존** — `(user_id, scope_type, scope_id)` 행 이미 존재 시 기존 Role 유지 (`INSERT ON CONFLICT DO NOTHING`).
3. **Member/Viewer enum WS Scope 확장** — `WORKSPACE` + `PROJECT` 양쪽 부여 가능.
4. **자동 가시 룰 신설** — ★22 (Project Scope → 상위 WS 자동 가시), ★23 (WS Scope Member → 하위 Project 자동 가시).
5. **ERD `user_roles` 강화** — CHECK 제약 확장, UNIQUE를 `(user_id, scope_type, scope_id)`로 단일 Role 강제 (라디오 모델 정합).
6. **Role 카운트 표기 Scope suffix** — `M(W)`/`M(P)`/`V(W)`/`V(P)` 필수.

### 영향 범위
| 파일 | 변경 절 |
|---|---|
| `docs/permissions.md` | §1 본문, §3 Role 정의 표, §4.2/§4.3/§4.4 컬럼 헤더, ★19/★20/★22/★23 |
| `docs/features/02-workspace.md` | 5곳 (요약·용어·유저스토리·§7 비즈니스 규칙·AC-4/5·REQ-WS-006) |
| `docs/features/05-project.md` | 4곳 (요약·유저스토리·§5.6 흐름·AC-6) |
| `docs/features/04-user.md` | §3 WO/PO 권한 표, §5.2 카운트 표기, §5.3 Scope-Role 검증 |
| `docs/features/_ux-role-matrix.md` | §2.3 WS 행 3-라디오, §2.4 신규 행 기본 Member, §3.3 Scope 일관성 |
| `docs/features/_ux-user-detail.md` | §2.3 Role 요약 suffix |
| `docs/api/openapi.yaml` | WS/Project 초대 endpoint description, UserListItem.roleCount schema |
| `docs/dba/erd.md` | §4.4 user_roles CHECK·UNIQUE·INSERT ON CONFLICT 명문화, §8 v1.2 변경 이력 |
| `docs/all-specs.md` | 자동 재생성 (pre-commit hook) |

### 다운스트림 알림 필요
- **DBA**: 마이그레이션 — UNIQUE 인덱스 교체 시 중복 행 선행 정합 점검 (`(user_id, scope_type, scope_id)` 기준 중복 확인).
- **BE**: 초대 SQL 변경 — `INSERT ... ON CONFLICT (user_id, scope_type, scope_id) DO NOTHING` 적용. Role-Scope 검증에 Member/Viewer WORKSPACE 허용 반영.
- **FE**: Role 카운트 컴포넌트에 Scope suffix `(W)`/`(P)` 표기. Role 매트릭스 WS 행에 3-라디오 (WO/Member/Viewer) 추가.
- **QA**: AC-4/5 (02-workspace.md), AC-6 (05-project.md) 갱신. ★22/★23 자동 가시 AC 신규 1건씩.

### 사인오프
| 단계 | 담당 | 일자 | 결과 |
|---|---|---|---|
| RFC 작성 | jesong | 2026-06-09 | ✅ |
| permissions.md / 02-workspace / 05-project / 04-user / UX / openapi 갱신 | PM | 2026-06-09 | ✅ |
| erd.md user_roles CHECK·UNIQUE 갱신 (v1.2) | DBA (반영) | 2026-06-09 | ✅ |
| all-specs.md 재생성 | Hook | 2026-06-09 | ✅ |
| 락 v2.7 README 이력 추가 | PM | 2026-06-09 | ✅ |
| BE/FE/QA 알림 | PM | ⬜ | - |

---

## 참고 링크
- [README.md](README.md) — 백로그·MVP 락 v2.2 본문
- [../srs.md](../srs.md) — 시스템 요구사항 명세 v0.2
- [../glossary.md](../glossary.md) — 용어 사전 v1.2
- [../permissions.md](../permissions.md) — 권한 매트릭스
- [../all-specs.md](../all-specs.md) — 합본 스냅샷 (자동 생성)
- [../../scripts/gen-all-specs.sh](../../scripts/gen-all-specs.sh) — 합본 생성 스크립트
- [../../scripts/hooks/pre-commit](../../scripts/hooks/pre-commit) — drift 차단 훅
