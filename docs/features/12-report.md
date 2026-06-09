# [F-REPORT] 리포트 · 대시보드 (Minimum)

| 항목 | 내용 |
| --- | --- |
| 기능 ID | F-REPORT |
| 상태 | 검토 |
| 우선순위 | Medium |
| 관련 도메인(glossary) | TestReport, PassRate, Dashboard, Defect, TestPlan |
| Figma | https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=0-1&p=f&m=dev |
| 작성자 | 기능 기획자 에이전트 |
| 최종 수정일 | 2026-06-05 |

> 본 기능은 **MVP 최소 리포트**(Plan별 Pass율·결함 상태 카운트)를 다룬다. 정형 RTM·커스텀 대시보드·내보내기는 Phase 2(F-TRACE, F-COMMON 확장).

## 1. 개요 / 목적
- Project 단위로 **테스트 진척률·통과율·결함 분포**를 한 화면에 요약 제공한다.
- 데모 시연용 핵심 지표 2종만(Plan별 Pass율·결함 상태 카운트).

## 2. 관련 용어
| 용어 | 정의 요약 |
| --- | --- |
| TestReport | 집계 보고 산출물 (glossary §5) |
| PassRate | (PASS Run 수) / (실행된 PlanItem 수) |
| Dashboard | 핵심 지표 시각화 화면 |

## 3. 사용자 / 권한
| Role | 권한 |
| --- | --- |
| PO / Member / Viewer | 본인이 멤버인 Project 리포트 조회 |
| CO | Company 내 모든 Project 리포트 조회 가능 (★ 본 MVP는 Project 멤버 기준만 적용. CO 전역 리포트는 Phase 2) |
| WO | 본인 WS 내 Project 멤버 한정(다른 Project는 가시 X — MVP) |

> 권한 매트릭스 정본: [`permissions.md`](../permissions.md) §4.4.

## 4. 사용자 스토리
- **PO**로서, 진행 중인 Plan들의 진척률·Pass율을 한 화면에서 본다.
- **Member**로서, 본인 담당 PlanItem 비율과 본인 결함 처리 현황을 본다.
- **Viewer**로서, Project 품질 지표(Pass율, 결함 카운트)를 조회한다.

## 5. 주요 흐름 / 시나리오

### 5.1 Project 리포트 조회
- `GET /api/v1/projects/{projId}/report` → 두 위젯 데이터 일괄 반환.

**응답 데이터**
```
{
  "plans": [
    {
      "planId": 1, "name": "Sprint-9 회귀",
      "status": "IN_PROGRESS",
      "itemCount": 50, "executedCount": 32,
      "passCount": 28, "failCount": 3, "blockedCount": 1, "skippedCount": 0,
      "passRate": 0.875
    },
    ...
  ],
  "defectStatusCount": {
    "OPEN": 12, "IN_PROGRESS": 5, "RESOLVED": 8, "CLOSED": 15
  },
  "totals": {
    "planCount": 4, "totalItems": 200, "totalExecuted": 132, "overallPassRate": 0.82
  }
}
```

### 5.2 필터·기간(선택)
- 쿼리 `?planStatus=IN_PROGRESS|CLOSED` (Plan 필터, 선택).
- 쿼리 `?dateFrom=...&dateTo=...` (TestRun executedAt 범위, 선택). MVP는 미적용도 OK.

### 5.3 새로고침
- 화면 진입 시 1회 조회. 수동 새로고침 버튼만(데모). 자동 폴링·웹소켓은 Phase 2.

### 5.4 대안 / 예외 흐름
- 비활성 Project → 403 `PROJ_INACTIVE`.
- Project 비멤버 → 404 (은닉).

## 6. 입력 / 출력

### 6.1 입력
| 항목 | 설명/제약 |
| --- | --- |
| (Path) projectId | 필수 |
| planStatus (Query) | 선택, enum |
| dateFrom / dateTo (Query) | 선택, ISO 8601 |

### 6.2 출력
| 필드 | 설명 |
| --- | --- |
| plans[] | Plan별 위젯 데이터 |
| defectStatusCount | 결함 상태 4종 카운트 |
| totals | 전역 합계·평균 |
| 응답 래퍼 | `success/code/message/data` (backend §4.5) |

## 7. 비즈니스 규칙
- **Plan 진척률·Pass율 정의** (F-PLAN §7 + F-RUN v2 정합):
  - `executedCount` = 최신 TestRun이 `status=COMPLETED`이고 `result != null`인 PlanItem 수.
  - `IN_PROGRESS` Run은 미실행으로 카운트(진척률에서 제외).
  - `passCount/failCount/blockedCount/skippedCount` = 위 중 각 집계 result 카운트.
  - `passRate = passCount / executedCount` (분모 0 → null).
- **결함 상태 카운트**: 활성(`is_deleted=false`) 결함만 집계.
- **삭제·비활성 PlanItem 제외**: 진척률 계산에서 제외.
- **격리**: Project 범위 내 데이터만 집계. CO 전역 리포트는 Phase 2.
- **신선도**: 실시간 쿼리(MVP). 캐시·집계 테이블 Phase 2.
- **권한**: 본인이 멤버인 Project만 노출. 다른 Project 호출 시 404.

## 8. 예외 / 에러
| 상황 | 처리 | 에러 코드 |
| --- | --- | --- |
| 미인증 | 401 | `AUTH_UNAUTHORIZED` |
| Project 비멤버 | 404 | (은닉) |
| 미존재 Project | 404 | `PROJ_NOT_FOUND` |
| 비활성 Project | 403 | `PROJ_INACTIVE` |
| 입력 형식 오류 | 400 | `COMMON_INVALID_INPUT` |

## 9. 수용 기준 (Acceptance Criteria)
- [ ] **AC-1** Given Project 멤버, When 리포트 조회, Then 200 + plans[]·defectStatusCount·totals 구조.
- [ ] **AC-2** Given Plan에 PlanItem 10건, 최신 Run 결과 COMPLETED·PASS 6 / FAIL 2 / BLOCKED 1 / SKIPPED 1, Then `executedCount=10`, `passCount=6`, `passRate=0.6`.
- [ ] **AC-3** Given 동일 PlanItem에 PASS Run 후 새 IN_PROGRESS Run 시작, Then 최신 Run이 미완료 상태이므로 그 Item은 미실행으로 카운트(`executedCount`에서 제외).
- [ ] **AC-3b** Given 동일 PlanItem에 PASS Run 후 COMPLETED·FAIL Run 새로 작성, Then 최신 Run(FAIL)이 집계 반영.
- [ ] **AC-4** Given 결함 OPEN 12, IN_PROGRESS 5, RESOLVED 8, CLOSED 15, Then `defectStatusCount` 정확.
- [ ] **AC-5** Given `is_deleted=true` 결함, When 카운트, Then 제외.
- [ ] **AC-6** Given Project 비멤버, When 호출, Then 404.
- [ ] **AC-7** Given 비활성 Project, When 호출, Then 403 `PROJ_INACTIVE`.
- [ ] **AC-8** Given `planStatus=IN_PROGRESS`, When 호출, Then `plans[]`에 IN_PROGRESS Plan만 포함.

## 10. 추적성
| Requirement ID | 설명 | 관련 기능/화면 | 관련 API(개념) | 연관 TestCase |
| --- | --- | --- | --- | --- |
| REQ-REPORT-001 | Project 리포트 단일 엔드포인트 | /projects/{id}/report | `GET /projects/{id}/report` | (QA) |
| REQ-REPORT-002 | Plan별 Pass율 위젯 | /report | (집계 쿼리) | (QA) |
| REQ-REPORT-003 | 결함 상태 카운트 위젯 | /report | (집계 쿼리) | (QA) |
| REQ-REPORT-004 | 격리(Project 멤버 기준) | 전역 | (서비스 규칙) | (QA) |

## 11. 오픈 이슈 / 비고
- **CO 전역 리포트**: Company 단위 합계·통계 — Phase 2.
- **시계열 차트**: Pass율 추이·결함 추이 — Phase 2.
- **내보내기**: CSV/PDF 다운로드 — Phase 2.
- **대시보드 커스터마이즈**: 위젯 추가·정렬 — Phase 2.
- **RTM(요구사항 추적성)**: F-TRACE Phase 2.
- **집계 캐시**: 운영 규모에서 실시간 쿼리 부담 → 집계 테이블/배치 Phase 2.
- **Severity·Priority별 결함 분포**: 추가 위젯 후보 — Phase 2.
