# Prototype Components (`_shell/components/`)

`docs/design/components/*.md` 명세 기반 CSS 컴포넌트 라이브러리. 페이지는 `<link>` + 클래스만 사용.

## 구성

| 파일 | 정본 명세 | 제공 클래스 |
|---|---|---|
| `button.css` | [`button.md`](../../components/button.md) | `.btn` + `.btn-primary/secondary/tertiary/ghost/link/destructive` × `.btn-sm/md/lg/xl` + `.btn-block`, `.btn-icon`, `.btn-pair` |
| `text-input.css` | [`text-input.md`](../../components/text-input.md) | `.field`, `.field-label`, `.field-req`, `.field-input`, `.field-textarea`, `.field-error`, `.field-helper`, `.field-success`, `.field-input-wrap` (leading/trailing 아이콘) |
| `checkbox.css` | [`checkbox.md`](../../components/checkbox.md) | `.cbx`, `.cbx-input`, `.cbx-box`, `.cbx-label` + size `.size-sm/lg` + `.cbx-group` |
| `select.css` | [`select.md`](../../components/select.md) | `.field-select` (native trigger only — Combobox/Multi-select 별도) |
| `modal.css` | [`modal.md`](../../components/modal.md) | `.modal-backdrop`, `.modal`, `.modal-header/body/footer`, `.modal-title`, `.modal-close` + sizes `.size-sm/md/lg/xl/2xl` |
| `data-table.css` | [`data-table.md`](../../components/data-table.md) | `.table-card`, `.table`, `.t-header/cell/body/row/data`, `.t-row.is-clickable/hover/selected/focused/disabled/highlighted`, `.row-title/sub`, `.more-btn`, `.search-input`(toolbar), `.t-bulk-bar`, `.t-empty/error/loading` |
| `pagination.css` | data-table.md §5·§9 | `.pagination`, `.page-btn`, `.page-numbers`, `.page-num` (`.is-active`), `.page-ellipsis`, `.page-summary`, `.page-size` |

## 페이지 적용

```html
<link rel="stylesheet" href="_shell/shell.css" />
<link rel="stylesheet" href="_shell/components/button.css" />
<link rel="stylesheet" href="_shell/components/text-input.css" />
<!-- 필요한 컴포넌트만 -->
```

## 클래스 명명 규약

- 컴포넌트 prefix: `btn`, `field`, `cbx`, `modal`
- State 클래스: `is-error`, `is-success`, `is-disabled`, `is-active`
- ARIA 속성: `aria-invalid="true"` 도 에러 시각 트리거(input/select)

## 토큰 사용

`shell.css` 의 `:root` 토큰 그대로 사용. 컴포넌트 명세의 색상 키워드 매핑:

| 명세 (Tailwind 스타일) | shell.css 토큰 |
|---|---|
| `brand-50..800` | `--brand-50..800` |
| `slate-50..700` | `--slate-50..700` (= `--neutral-*` 별칭) |
| `red-500/600`, `red-error-fig` | `--red-500/600`, `--red-error-fig` |
| `green-500/600` | `--green-500/600` |
| `yellow-500/600` | `--yellow-500/600` |

## 미수록 / 보류

| 컴포넌트 | 상태 | 비고 |
|---|---|---|
| Toast | `shell.css` + `shell.js` 임베드 | `tmsToast()` API. 추후 `components/toast.css` 분리 검토 (현재는 shell.js 클래스 의존) |
| Drawer | TBD | components/drawer.md 명세 존재. 사용 화면 등장 시 추가 |
| Tabs / Tooltip / Popover / Badge / Avatar / Skeleton / DatePicker / DataTable / FileUpload / Radio / Switch / EmptyState / ConfirmDialog | TBD | 명세 (`components/*.md`) 모두 존재. 페이지에서 처음 쓸 때 추가 |

## 추가 가이드

신규 컴포넌트 추가 시:
1. `docs/design/components/<name>.md` 명세 정독.
2. `_shell/components/<name>.css` 생성. 명세의 Variant × State × Size 매트릭스 정합.
3. 본 README 표 갱신.
4. 페이지 마이그 시 인라인 스타일 → 클래스 교체.
