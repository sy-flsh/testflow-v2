# Badge 컴포넌트 명세 (StatusBadge · RoleBadge · PriorityBadge · Tag)

| 항목 | 내용 |
| --- | --- |
| 문서명 | Badge 컴포넌트 명세 (StatusBadge · RoleBadge · PriorityBadge · Tag) |
| 문서 버전 | v0.1 |
| 최초 작성일 | 2026-06-08 |
| 최종 개정일 | 2026-06-08 |
| 작성 주체 | Frontend 개발 에이전트 |
| 문서 등급 | L2 |
| 상위 문서 | `docs/design/figma-master.md` §7.3 / `docs/design/00_design_system_v3.md` §5 Status Badge / `docs/integration/codes.md` (metadata-service 정본) |
| 적용 범위 | 모든 상태/역할/우선순위/태그 표시 |
| 코드 경로 (예정) | `frontend/src/components/Badge/StatusBadge.tsx`, `RoleBadge.tsx`, `PriorityBadge.tsx`, `Tag.tsx` |

> 색상은 **codes.md 정본** 우선. 본 문서는 시각 규격·매핑만.

---

## 1. Variant

| Variant | Figma node-id | 용도 | 데이터 소스 |
| --- | --- | --- | --- |
| StatusBadge | TBD | TestRun status, ExecutionResult, DefectStatus, InviteStatus | metadata-service `data.color` |
| RoleBadge | TBD | Master/CO/WO/PO/Member/Viewer | 하드코딩 (Role 6단 고정) |
| PriorityBadge | TBD | HIGH/MEDIUM/LOW | `tms.priority` |
| SeverityBadge | TBD | CRITICAL/MAJOR/MINOR/TRIVIAL | `tms.defect_severity` |
| Tag | TBD | TC 태그, 일반 분류 | 자유 입력 |

---

## 2. 스타일 (전 Variant 공통 base)

| 항목 | 값 |
| --- | --- |
| Height | 20px (sm), 24px (md), 28px (lg) |
| Padding X | 8px (sm), 10px (md), 12px (lg) |
| Font | Text xs (sm), sm (md) / Medium |
| Border-radius | 4px (Square) / 999px (Pill, 기본) |
| Border | optional 1px solid (Outline variant) |

---

## 3. Style variant

| Style | bg | text | border |
| --- | --- | --- | --- |
| Solid | `<color>-600` | white | — |
| Subtle (기본) | `<color>-50` | `<color>-700` | — |
| Outline | white | `<color>-700` | `<color>-300` |

> 기본은 **Subtle** (시각 노이즈 최소). 강조 필요 시 Solid.

---

## 4. 색상 매핑 (정본 우선순위)

| 우선순위 | 출처 | 비고 |
| --- | --- | --- |
| 1 | metadata-service `data.color` (`docs/integration/codes.md`) | 신규 코드 추가/미사용 시 즉시 반영 |
| 2 | 본 §4.1 fallback 표 | metadata 미동기 시 |

### 4.1 Fallback 매핑

#### ExecutionResult (`tms.execution_result`, 6종)
| 코드 | 색상 |
| --- | --- |
| PASS | green |
| FAIL | red |
| BLOCK | yellow |
| SKIP | neutral |
| UNTESTED | slate |
| PENDING | slate |

#### DefectStatus (`tms.defect_status`, 4종)
| 코드 | 색상 |
| --- | --- |
| OPEN | red |
| IN_PROGRESS | blue |
| RESOLVED | green |
| CLOSED | neutral |

#### DefectSeverity (`tms.defect_severity`, 4종)
| 코드 | 색상 |
| --- | --- |
| CRITICAL | red |
| MAJOR | orange |
| MINOR | yellow |
| TRIVIAL | green |

#### Priority (`tms.priority`, 3종)
| 코드 | 색상 |
| --- | --- |
| HIGH | red |
| MEDIUM | yellow |
| LOW | green |

#### InviteStatus (`tms.invite_status`, derived 4종)
| 코드 | 색상 |
| --- | --- |
| INVITED | yellow |
| ACTIVE | green |
| WITHDRAWN | neutral |
| EXPIRED | red |

#### Role (하드코딩)
| Role | 색상 |
| --- | --- |
| MASTER | purple |
| CO | brand |
| WO | blue |
| PO | green |
| MEMBER | neutral |
| VIEWER | slate |

#### TestRun status
| 코드 | 색상 |
| --- | --- |
| IN_PROGRESS | blue |
| COMPLETED | green |

---

## 5. 라벨 (i18n)

| 영역 | 키 패턴 |
| --- | --- |
| ExecutionResult | `code.executionResult.<CODE>` |
| DefectStatus | `code.defectStatus.<CODE>` |
| DefectSeverity | `code.defectSeverity.<CODE>` |
| Priority | `code.priority.<CODE>` |
| Role | `code.role.<CODE>` |
| InviteStatus | `code.inviteStatus.<CODE>` |
| TestRun status | `code.testRunStatus.<CODE>` |

> raw 문구는 metadata-service `labelKo`/`labelEn` 정본 또는 `00_design_system_v3.md` §6 (작성 예정 — code.* 키 정본).

---

## 6. Tag (자유 입력)

| 항목 | 값 |
| --- | --- |
| 색상 | 기본 `neutral` (Subtle) |
| 닫기 가능 | 우측 `[×]` (편집 모드일 때만) |
| 인터랙티브 | 클릭 시 필터 적용 옵션 |
| 최대 길이 | 32자 |

---

## 7. 접근성

- 시맨틱 `<span>` (텍스트만) 또는 `<button>` (인터랙티브)
- 색상만으로 정보 전달 금지 — 텍스트 라벨 필수
- 색맹 고려: 색상 + 아이콘 또는 색상 + 텍스트 패턴 권장 (Critical 등 중요 상태)

---

## 8. 코드 매핑

| 항목 | 코드 경로 |
| --- | --- |
| StatusBadge | `frontend/src/components/Badge/StatusBadge.tsx` |
| RoleBadge | `frontend/src/components/Badge/RoleBadge.tsx` |
| PriorityBadge | `frontend/src/components/Badge/PriorityBadge.tsx` |
| SeverityBadge | `frontend/src/components/Badge/SeverityBadge.tsx` |
| Tag | `frontend/src/components/Tag/Tag.tsx` |
| codes 훅 | `frontend/src/hooks/useCodes.ts` (metadata-service 캐싱) |

---

## 9. 변경 이력

| 버전 | 일자 | 변경 |
| --- | --- | --- |
| v0.1 | 2026-06-08 | 초안. Variant 5종 + Style 3종 (Solid/Subtle/Outline, 기본 Subtle), 색상 매핑 정본 우선순위 (metadata-service > fallback) + 7개 코드 그룹 fallback 표 + i18n 키 패턴 `code.<group>.<CODE>`. Figma node-id 전 TBD. |
