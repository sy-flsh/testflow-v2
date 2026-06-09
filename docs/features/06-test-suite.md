# [F-TS] 테스트 스위트(TestSuite) 관리

| 항목 | 내용 |
| --- | --- |
| 기능 ID | F-TS |
| 상태 | 검토 |
| 우선순위 | High |
| 관련 도메인(glossary) | TestSuite, TestCase, Project |
| Figma | https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=0-1&p=f&m=dev |
| 작성자 | 기능 기획자 에이전트 |
| 최종 수정일 | 2026-06-05 |

> 본 기능은 Project 내부의 **TestSuite 트리 구조**(폴더형)의 생성·이름변경·이동·삭제·조회를 다룬다. TestCase 자체는 F-TC에서 관리하며, 본 문서는 트리/그룹화 메타에 집중한다. 권한: [`permissions.md`](../permissions.md) §4.4.

## 1. 개요 / 목적
- TestCase를 **논리적 폴더 트리**로 분류·조직화한다.
- 트리는 Project 단위로 분리되며, 멀티 레벨(트리 깊이 제한 없음, 권장 5 이하)을 허용한다.
- 자산 검색·필터링의 1차 정렬 기준이 된다.

## 2. 관련 용어
| 용어 | 정의 요약 |
| --- | --- |
| TestSuite | TestCase 묶음(폴더). 트리 구조 — parent_suite_id 자기 참조 |
| TestCase | TestSuite에 속하는 최소 검증 단위 (F-TC) |

## 3. 사용자 / 권한
| Role | 권한 |
| --- | --- |
| PO / Member | Suite 생성·수정·이동·삭제, 트리 조회 |
| Viewer | 트리 조회만 |
| 다른 Role(CO/WO 등) | Project 멤버 아닌 경우 접근 불가 |

> 권한 매트릭스 정본: [`permissions.md`](../permissions.md) §4.4.

## 4. 사용자 스토리
- **PO/Member**로서, TC를 분류하기 위해, Suite 폴더를 만들고 하위에 더 세분된 Suite를 추가한다.
- **PO/Member**로서, 분류 변경에 따라, Suite를 다른 부모로 드래그하여 이동한다.
- **PO/Member**로서, 더 이상 필요 없는 Suite를 (TC 비어 있을 때) 삭제한다.
- **모든 멤버**로서, 좌측 트리에서 Suite 계층을 한눈에 본다.

## 5. 주요 흐름 / 시나리오

### 5.1 트리 조회
- `GET /api/v1/projects/{projId}/suites/tree` → 전체 트리 1회 반환(데모 규모 OK). 큰 트리 페치 최적화는 Phase 2.
- 응답 노드: `{id, name, parentSuiteId, sortOrder, testCaseCount, children: [...]}`.

### 5.2 Suite 생성
1. PO/Member가 트리 노드 위에서 "+추가" → 이름·상위 Suite(드롭다운/현재 노드) 입력.
2. `POST /api/v1/projects/{projId}/suites`.
3. 서버: parent 검증(같은 Project 소속), name은 같은 부모 내 unique 권장(중복 시 경고, 데모는 허용).
4. `sort_order` 자동 부여(최대값 + 1).

### 5.3 Suite 이름변경
- `POST /api/v1/projects/{projId}/suites/{suiteId}/update` (name).

### 5.4 Suite 이동 (드래그 또는 액션)
1. 트리에서 드래그 → 새 부모 노드에 드롭. 또는 `POST /api/v1/projects/{projId}/suites/{suiteId}/move` (`newParentSuiteId`, `newSortOrder`).
2. 서버 검증:
   - 새 부모가 본인의 후손이면 안 됨(순환 방지) → 400 `TS_CYCLE_FORBIDDEN`.
   - 새 부모가 같은 Project 소속인지 검증.
3. 동일 부모 내 `sort_order` 재배치.

### 5.5 Suite 삭제 (soft, **작성자 한정 ★16**)
1. **작성자 본인**(`created_by = 요청자`)이 삭제 → 확인 다이얼로그 → `POST /api/v1/projects/{projId}/suites/{suiteId}/delete`.
2. 서버 검증:
   - **`created_by = 요청자`** (Rule 1·★16). 아니면 403 `AUTH_FORBIDDEN`. PO/CO 우회 X.
   - **TC가 0건이고 자식 Suite도 0건일 때만 삭제 허용**(소속 자산 안전).
   - 비어있지 않으면 400 `TS_NOT_EMPTY`.
3. `is_deleted=true`. Phase 2 승인 단계 도입 예정.

### 5.6 대안 / 예외 흐름
- 같은 부모 내 같은 이름 → 데모는 허용(경고). 운영 정책은 Phase 2.
- 트리 깊이 무제한이나 권장 5 이하(UI 시각 한계). 강제 제한은 Phase 2.
- 비활성 Project 내 모든 액션 → 403 `PROJ_INACTIVE`.

## 6. 입력 / 출력

### 6.1 입력
| 구분 | 항목 | 설명/제약 |
| --- | --- | --- |
| 생성 | name | 필수, 1~100자 |
| 생성 | parentSuiteId | 선택(null=root) |
| 수정 | name | 필수 |
| 이동 | newParentSuiteId | 선택(null=root) |
| 이동 | newSortOrder | 선택, 0-based |
| 삭제 | (Path) suiteId | 필수 |

### 6.2 출력
| 구분 | 항목 | 설명 |
| --- | --- | --- |
| 트리 노드 | id, name, parentSuiteId, sortOrder, testCaseCount, children[] | 재귀 |
| 단건 | id, name, parentSuiteId, sortOrder, testCaseCount, createdAt | |
| 응답 래퍼 | `success/code/message/data` | backend §4.5 |

## 7. 비즈니스 규칙
- **트리 무결성**: 순환 금지(자기 자손에 이동 불가).
- **삭제 권한 (Rule 1·★16)**: `created_by = 요청자`인 작성자만. PO/CO 우회 X.
- **삭제 전제**: 빈 Suite만 삭제 가능. TC·자식 Suite 보유 시 거부.
- **이동 후 sort_order**: 같은 부모 내 0부터 연속(빈 자리 없게 재정렬).
- **격리**: parent 또는 이동 대상이 같은 Project 소속이어야 함.
- **Soft delete**: 물리 삭제 금지(`is_deleted=true`). 삭제된 Suite는 트리에서 비노출.
- **격리키**: `test_suites`는 `company_id`, `workspace_id`, `project_id` 모두 보유.

## 8. 예외 / 에러
| 상황 | 처리 | 에러 코드 |
| --- | --- | --- |
| 미인증 | 401 | `AUTH_UNAUTHORIZED` |
| Project 멤버 아님 | 403 | `AUTH_FORBIDDEN` |
| 미존재 Suite | 404 | `TS_NOT_FOUND` |
| 순환 이동 시도 | 400 | `TS_CYCLE_FORBIDDEN` |
| 비어있지 않은 Suite 삭제 | 400 | `TS_NOT_EMPTY` |
| 작성자 아닌 Suite 삭제 시도 | 403 | `AUTH_FORBIDDEN` (★16) |
| 다른 Project 노드 이동 시도 | 400 | `TS_CROSS_PROJECT_FORBIDDEN` |
| 비활성 Project | 403 | `PROJ_INACTIVE` |
| 입력 형식 오류 | 400 | `COMMON_INVALID_INPUT` |

## 9. 수용 기준 (Acceptance Criteria)
- [ ] **AC-1** Given PO, When root에 Suite 생성하면, Then 200 + 트리에 추가.
- [ ] **AC-2** Given Member, When 하위 Suite 생성하면, Then 200 + parent 트리에 자식 추가.
- [ ] **AC-3** Given Viewer, When Suite 생성 시도하면, Then 403 `AUTH_FORBIDDEN`.
- [ ] **AC-4** Given Suite A를 A의 자손 노드로 이동 시도, When 이동하면, Then 400 `TS_CYCLE_FORBIDDEN`.
- [ ] **AC-5** Given 다른 Project의 Suite를 부모로 지정, When 이동/생성하면, Then 400 `TS_CROSS_PROJECT_FORBIDDEN`.
- [ ] **AC-6** Given TC 1건 보유 Suite, When 삭제하면, Then 400 `TS_NOT_EMPTY`.
- [ ] **AC-7** Given 자식 Suite 1건 보유, When 삭제하면, Then 400 `TS_NOT_EMPTY`.
- [ ] **AC-8** Given **작성자 본인** + 빈 Suite, When 삭제, Then 200 + `is_deleted=true` + 트리에서 비노출.
- [ ] **AC-8b** Given **작성자 아닌 PO** + 빈 Suite, When 삭제 시도, Then 403 `AUTH_FORBIDDEN` (★16).
- [ ] **AC-9** Given 트리 조회, When 요청하면, Then 재귀 노드 구조 + 각 노드 `testCaseCount` 정확.
- [ ] **AC-10** Given 비활성 Project, When Suite API 호출하면, Then 403 `PROJ_INACTIVE`.

## 10. 추적성
| Requirement ID | 설명 | 관련 기능/화면 | 관련 API(개념) | 연관 TestCase |
| --- | --- | --- | --- | --- |
| REQ-TS-001 | Suite 트리 조회 | /projects/{id}/suites | `GET /projects/{id}/suites/tree` | (QA) |
| REQ-TS-002 | Suite 생성(parent 지정) | /projects/{id}/suites | `POST /projects/{id}/suites` | (QA) |
| REQ-TS-003 | Suite 이름변경 | /projects/{id}/suites | `POST /projects/{id}/suites/{id}/update` | (QA) |
| REQ-TS-004 | Suite 이동(순환 방지) | /projects/{id}/suites | `POST /projects/{id}/suites/{id}/move` | (QA) |
| REQ-TS-005 | 빈 Suite 삭제(soft) | /projects/{id}/suites | `POST /projects/{id}/suites/{id}/delete` | (QA) |
| REQ-TS-006 | 격리 검증(같은 Project) | 전역 | (서비스 규칙) | (QA) |

## 11. 오픈 이슈 / 비고
- **이름 unique 정책**: 같은 부모 내 중복 허용 여부 — 데모 허용(경고). 운영 강제 — Phase 2.
- **트리 깊이 제한**: 무제한이나 5 이하 권장. 강제 제한 룰 — Phase 2.
- **빈 Suite 삭제 강제**: 비어있지 않은 Suite를 일괄 삭제(하위 TC 함께)할지 — 데모는 불가, Phase 2 검토.
- **드래그 UX**: 키보드 접근성·터치 등 Phase 2.
- **트리 검색**: 트리 내 이름 검색 강조 — Phase 2.
