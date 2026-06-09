# FileUpload 컴포넌트 명세

| 항목 | 내용 |
| --- | --- |
| 문서명 | FileUpload 컴포넌트 명세 |
| 문서 버전 | v0.1 |
| 최초 작성일 | 2026-06-08 |
| 최종 개정일 | 2026-06-08 |
| 작성 주체 | Frontend 개발 에이전트 |
| 문서 등급 | L2 |
| 상위 문서 | `docs/design/figma-master.md` §7.2 / `docs/features/11-attachment.md` (F-ATTACH) / `docs/integration/openapi.yaml` `POST /attachments` |
| 적용 범위 | F-ATTACH — 단일 이미지 업로드 (Defect·TestRun·TestCase 첨부) |
| 코드 경로 (예정) | `frontend/src/components/Form/FileUpload.tsx`, `AttachmentList.tsx` |

> MVP 락: **이미지 단일·로컬 디스크**. 다중·동영상·외부 스토리지는 Phase 2.

---

## 1. State 매트릭스

| State | Figma node-id | 시각 | 트리거 |
| --- | --- | --- | --- |
| Empty | TBD | dropzone (점선 border `slate-300`), 아이콘 + "파일을 끌어다 놓거나 클릭" | 초기 |
| Hover (마우스 over) | TBD | border `brand-500`, bg `brand-50` | 마우스 |
| Drag-over | TBD | border `brand-600` (solid), bg `brand-100` | 파일 drag-enter |
| Uploading | TBD | progress bar + 파일명 + 취소 `[×]` | 파일 선택/drop 직후 |
| Uploaded | TBD | 썸네일 + 파일명 + 사이즈 + 삭제 `[×]` | 200 응답 |
| Error | TBD | red border + error text (i18n 키) | 400/413/네트워크 실패 |
| Disabled | TBD | dropzone dim, 클릭 잠금 | 권한 없음 또는 상위 폼 잠금 |

---

## 2. 제약

| 항목 | 값 | 비고 |
| --- | --- | --- |
| 다중 | X (1개만) | F-ATTACH MVP 락 |
| 허용 MIME | `image/png`, `image/jpeg`, `image/gif`, `image/webp` | BE 정합 |
| 최대 크기 | 10 MB | BE 정합. 초과 시 413 `ATTACHMENT_TOO_LARGE` |
| 파일명 길이 | 255자 이하 | |

위반 시 i18n 키:
- 형식 위반 → `error.attachment.invalidType`
- 크기 초과 → `error.attachment.tooLarge`

---

## 3. 업로드 흐름

```
1. 파일 선택 (input click or drop)
   ↓
2. 클라이언트 검증 (MIME, 크기) → 실패 시 Error state
   ↓
3. multipart/form-data POST /attachments
   ↓
4. progress event → progress bar 갱신
   ↓
5-a. 200 → Uploaded state (썸네일 표시)
5-b. 400/413 → Error state + Toast
```

취소: Uploading 중 `[×]` → `AbortController` → Empty state.

---

## 4. 썸네일·미리보기

| 항목 | 값 |
| --- | --- |
| 썸네일 크기 | 64 × 64 (정사각, object-fit cover) |
| 미리보기 | 썸네일 클릭 시 모달 (전체 크기) |
| placeholder | 업로드 중 또는 로딩 실패 시 아이콘 + 파일명 |

---

## 5. 합성 — AttachmentList

복수 첨부 표시 (Defect·TestRun이 N개 첨부 보유 가능 — 단일 업로드를 반복).

| 항목 | 값 |
| --- | --- |
| 레이아웃 | 그리드 (3 columns 기본) 또는 리스트 |
| 각 아이템 | 썸네일 + 파일명 + 사이즈 + 삭제 `[×]` |
| 신규 추가 | 마지막에 FileUpload Empty state 1개 (dropzone) |
| 삭제 | 즉시 삭제 X — ConfirmDialog (`confirm.common.discard` 패턴 또는 전용 `confirm.attachment.delete`) |

---

## 6. 접근성

- `<input type="file" accept="image/*">` 시맨틱
- dropzone: `role="button"` + `aria-label="파일 업로드"` (드래그 영역)
- 키보드: `Enter`/`Space`로 파일 선택 다이얼로그 열기
- Uploading: `aria-busy="true"` + `aria-valuenow`(progress)
- Error: `aria-invalid="true"` + `aria-describedby`(error text)

---

## 7. 코드 매핑

| 항목 | 코드 경로 |
| --- | --- |
| FileUpload | `frontend/src/components/Form/FileUpload.tsx` |
| AttachmentList | `frontend/src/components/Attachment/AttachmentList.tsx` |
| 업로드 훅 | `frontend/src/hooks/useFileUpload.ts` (`AbortController` + progress) |

---

## 8. 변경 이력

| 버전 | 일자 | 변경 |
| --- | --- | --- |
| v0.1 | 2026-06-08 | 초안. State 7종, 제약 (이미지·10MB·단일), 업로드 흐름 5단계, AttachmentList 합성. Figma node-id 전 TBD. |
