# Avatar 컴포넌트 명세 (UserAvatar · Avatar · AvatarGroup)

| 항목 | 내용 |
| --- | --- |
| 문서명 | Avatar 컴포넌트 명세 (UserAvatar · Avatar · AvatarGroup) |
| 문서 버전 | v0.1 |
| 최초 작성일 | 2026-06-08 |
| 최종 개정일 | 2026-06-08 |
| 작성 주체 | Frontend 개발 에이전트 |
| 문서 등급 | L2 |
| 상위 문서 | `docs/design/figma-master.md` §7.3 |
| 적용 범위 | 사용자 표시 (담당자·생성자·헤더 프로필·멤버 리스트) |
| 코드 경로 (예정) | `frontend/src/components/Avatar/Avatar.tsx`, `UserAvatar.tsx`, `AvatarGroup.tsx` |

---

## 1. Size

| Size | px | Font | 사용 |
| --- | --- | --- | --- |
| xs | 20 | 10px | 테이블 행 내 인라인 |
| sm | 24 | 11px | 리스트 아이템 |
| **md** (기본) | 32 | 13px | 폼·카드·헤더 |
| lg | 40 | 16px | 사이드바 프로필 |
| xl | 56 | 20px | 프로필 페이지 |
| 2xl | 80 | 28px | 설정 페이지 헤더 |

원형 (border-radius: 50%) 기본. Square 옵션 (radius 8px).

---

## 2. State

| State | Figma node-id | 비고 |
| --- | --- | --- |
| Image | TBD | 사용자 업로드 이미지 (현재 MVP 외 — Phase 2) |
| Initials (기본) | TBD | 이름 첫 2글자 (한글 1자 또는 영문 2자) |
| Loading | TBD | Skeleton 원형 |
| Empty / Unknown | TBD | 기본 아이콘 (`lucide-react: User`) + `slate-200` bg |
| Deactivated | TBD | grayscale + opacity 0.6 |

---

## 3. Initials 색상

이름 해시 기반 결정적 색상 (같은 사용자 = 항상 같은 색).

| 색상 풀 | 8종 |
| --- | --- |
| `brand` | bg `brand-500`, text white |
| `green` | bg `green-500`, text white |
| `purple` | bg `purple-500`, text white |
| `orange` | bg `orange-500`, text white |
| `pink` | bg `pink-500`, text white |
| `cyan` | bg `cyan-500`, text white |
| `indigo` | bg `indigo-500`, text white |
| `red` | bg `red-500`, text white (Deactivated 충돌 회피 — orange로 대체 가능) |

해시: `userId` 또는 `name`의 sum % 8.

---

## 4. AvatarGroup

| 항목 | 값 |
| --- | --- |
| Overlap | -8px (md), -6px (sm) |
| 최대 표시 | 5명 (초과 시 `+N` 마지막 아바타) |
| 라벨 | `+12` 형식, `slate-200` bg, `neutral-700` text |
| Hover (각 아바타) | z-index 상승 + tooltip (이름) |
| 클릭 | 사이드바 멤버 목록 열기 또는 popover |

---

## 5. Status indicator (선택)

우하단 작은 원 (8px). 색상은 도메인 의미에 따라.

| 표시 | 의미 | 사용 |
| --- | --- | --- |
| green | 활성 | 일반 |
| slate | 비활성·탈퇴 | grayscale 패턴과 병행 |
| yellow | 초대 중 | InviteStatus 정합 |

> MVP는 status indicator 표시 X (정보 과부하). Phase 2 도입.

---

## 6. 접근성

- 시맨틱 `<img>` (image variant) — `alt="<사용자 이름>"` 필수
- Initials variant: `<span role="img" aria-label="<사용자 이름>">` 사용
- Tooltip으로 전체 이름 표시 (작은 사이즈에서)
- 색상만으로 정보 전달 금지 (Status indicator는 텍스트 라벨 보완)

---

## 7. 코드 매핑

| 항목 | 코드 경로 |
| --- | --- |
| Avatar | `frontend/src/components/Avatar/Avatar.tsx` |
| UserAvatar (User 객체 → Avatar 합성) | `frontend/src/components/Avatar/UserAvatar.tsx` |
| AvatarGroup | `frontend/src/components/Avatar/AvatarGroup.tsx` |

---

## 8. 변경 이력

| 버전 | 일자 | 변경 |
| --- | --- | --- |
| v0.1 | 2026-06-08 | 초안. Size 6종 + State 5종 (Image/Initials/Loading/Empty/Deactivated) + Initials 색상 풀 8종 (이름 해시) + AvatarGroup 5명 +N 패턴 락. Status indicator MVP 보류. Figma node-id 전 TBD. |
