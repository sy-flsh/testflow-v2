# TMS 디자인 (Design Index)

TMS의 디자인 시스템·Figma 매핑·UI 컴포넌트 명세·HTML 프로토타입을 보관하는 영역.

- **정본 1**: `00_design_system_v3.md` — 컬러/타이포/간격/레이아웃/앱 셸/Auth Layout/컴포넌트 (락 v2.4 채택)
- **정본 2**: `figma-master.md` — Figma 파일 ↔ 화면 ↔ 라우트 ↔ 표현 패턴 매핑 (file_key `5G8kNWGjSSPaG3OepCfU55`)
- **충돌 우선순위**: 권한·격리·에러·AC는 기능 명세 우선 / 시각·인터랙션·레이아웃은 Figma·디자인 시스템 우선 (SRS §5.0)

---

## 📋 파일 목록

| 경로 | 역할 |
| --- | --- |
| [`00_design_system_v3.md`](00_design_system_v3.md) | 디자인 시스템 정본 (Tailwind + shadcn/ui + lucide + Recharts 가정) |
| [`figma-master.md`](figma-master.md) | Figma 노드 매핑 정본 (Shell + 콘텐츠 합성 워크플로 포함) |
| [`components/`](components/) | 20종 UI 컴포넌트 명세 (avatar/badge/button/checkbox/confirm-dialog/data-table/date-picker/drawer/empty-state/file-upload/modal/popover/radio/select/skeleton/switch/tabs/text-input/toast/tooltip) |
| [`prototypes/`](prototypes/) | HTML 정적 프로토타입 (인증·워크스페이스 흐름) |
| [`prototypes/_shell/`](prototypes/_shell/) | 공통 Shell (header/sidebar/CSS/JS) — 모든 인증 후 화면이 합성 |

---

## 🎨 디자인 토큰 요약

- **Brand**: Purple 스케일 (`--brand-50` ~ `--brand-950`, primary `--brand-600 #7F56D9`)
- **Neutral / Slate**: 회색 스케일 2종
- **z-index**: `--z-modal 200` / `--z-drawer 150` (락 v2.4)
- **라우트 토큰**: `/defects` · `--defect-*` (락 v2.4에서 `/bugs` · `--bug-*` 폐기)
- **반응형**: 데스크톱 1280px+ 기본 + 모바일 <768 활성화 (락 v2.4)

---

## 🔗 다운스트림

- Frontend 구현: `../standards/frontend-coding-standard.md` §UI 표현 패턴 / §디자인 토큰 적용
- 기능 메타: 각 `../features/NN-*.md` §1 메타 표의 **Figma** 행이 `figma-master.md`와 동기화
- 합성 워크플로: 콘텐츠 노드 fetch → Shell 노드 fetch → 합성 → 라우트 검증 (`figma-master.md` §0.2)
