# [F-ATTACH] 첨부(Attachment) 관리

| 항목 | 내용 |
| --- | --- |
| 기능 ID | F-ATTACH |
| 상태 | 검토 |
| 우선순위 | High |
| 관련 도메인(glossary) | Attachment |
| Figma | https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=0-1&p=f&m=dev |
| 작성자 | 기능 기획자 에이전트 |
| 최종 수정일 | 2026-06-05 |

> 본 기능은 **TestRun·Defect에 첨부 파일(이미지/단순 파일) 업로드·조회·다운로드·삭제**를 다룬다. MVP는 **단일 업로드, 로컬 디스크 저장, 이미지 우선**. S3·다중 업로드·미리보기는 Phase 2.

## 1. 개요 / 목적
- 결함 재현 증거(스크린샷·로그)·실행 결과 보조 자료를 TestRun·Defect에 첨부한다.
- Project 멤버 권한·격리 규칙을 첨부에도 동일 적용한다.

## 2. 관련 용어
| 용어 | 정의 요약 |
| --- | --- |
| Attachment | TestRun 또는 Defect에 종속된 파일 메타 + 저장 경로 |
| owner_type | `TEST_RUN` 또는 `DEFECT` |
| owner_id | 해당 도메인 행 식별자 |

## 3. 사용자 / 권한
| Role | 권한 |
| --- | --- |
| PO / Member | 업로드, 조회, 다운로드, **본인 업로드 첨부 삭제(작성자 한정 ★16, 24h 윈도 폐기)** |
| Viewer | 조회·다운로드만 |

> 권한 매트릭스 정본: [`permissions.md`](../permissions.md) §4.4.

## 4. 사용자 스토리
- **PO/Member**로서, 결함 재현 스크린샷을 결함에 첨부한다.
- **PO/Member**로서, 실행 화면의 결과 캡처를 TestRun에 첨부한다.
- **모든 멤버**로서, 첨부 목록을 보고 원본 다운로드한다.
- **본인 업로드자**로서, 잘못 올린 파일을 삭제한다(작성자 한정, 시간 제한 없음).

## 5. 주요 흐름 / 시나리오

### 5.1 첨부 업로드
1. TestRun/Defect 상세 → "첨부 추가" → 파일 선택(이미지 권장).
2. `POST /api/v1/projects/{projId}/attachments` (multipart: `file`, `ownerType`, `ownerId`).
3. 서버 검증:
   - ownerType/ownerId가 같은 Project 소속인지
   - 확장자 화이트리스트(`png`/`jpg`/`jpeg`/`gif`/`webp`/`pdf`/`txt`/`log` — MVP)
   - 파일 크기 ≤ 10MB
   - MIME 매칭(확장자 위장 차단)
4. 파일을 **로컬 디스크 저장**(경로: `{base}/{companyId}/{wsId}/{projId}/{yyyy}/{mm}/{uuid}.{ext}`).
5. `attachments` 1행 생성(`storage_path`, `file_name`(원본), `mime_type`, `size`).
6. 응답: Attachment 메타.

### 5.2 첨부 목록 조회
- `GET /api/v1/projects/{projId}/attachments?ownerType=DEFECT&ownerId={id}` → 페이지네이션.

### 5.3 첨부 다운로드
- `GET /api/v1/projects/{projId}/attachments/{attachmentId}/download` → 권한 검증 후 파일 스트림.
- 응답 헤더: `Content-Disposition: attachment; filename="{원본명}"`.
- 미리보기는 별도 인라인 URL 미제공(데모는 다운로드 후 보기). 이미지 인라인 표시 Phase 2.

### 5.4 첨부 삭제 (soft, **작성자 한정 ★16**)
- `POST /api/v1/projects/{projId}/attachments/{attachmentId}/delete`.
- **작성자(`created_by` = 업로드자) 한정** (Rule 1·★16). 시간 윈도·PO 우회 폐기.
- soft delete (`is_deleted=true`). 실제 파일은 보존(주기적 정리는 Phase 2).
- Phase 2 승인 단계 도입 예정.

### 5.5 대안 / 예외 흐름
- 다른 Project owner 참조 → 400 `ATTACH_CROSS_PROJECT_FORBIDDEN`.
- 확장자/MIME 거부 → 400 `ATTACH_TYPE_NOT_ALLOWED`.
- 크기 초과 → 400 `ATTACH_SIZE_EXCEEDED`.
- 미존재 owner → 404 `ATTACH_OWNER_NOT_FOUND`.
- 비활성 Project → 403 `PROJ_INACTIVE`.

## 6. 입력 / 출력

### 6.1 입력
| 구분 | 항목 | 설명/제약 |
| --- | --- | --- |
| 업로드 | file | 필수, 10MB 이하 |
| 업로드 | ownerType | 필수, `TEST_RUN`/`DEFECT` |
| 업로드 | ownerId | 필수 |
| 다운로드 | (Path) attachmentId | 필수 |
| 삭제 | (Path) attachmentId | 필수 |
| 목록 | ownerType/ownerId/page/size/sort | 필수 owner 필터 |

### 6.2 출력
| 구분 | 항목 | 설명 |
| --- | --- | --- |
| Attachment 표현 | id, fileName, mimeType, size, ownerType, ownerId, uploadedBy(요약), createdAt | `storage_path` 미노출 |
| 다운로드 | 파일 스트림 | Content-Disposition |
| 응답 래퍼 | `success/code/message/data` | backend §4.5 |

## 7. 비즈니스 규칙
- **단일 업로드 (MVP)**: 한 번에 1파일. 다중 업로드 Phase 2.
- **로컬 디스크**: S3 등 객체 저장소 Phase 2.
- **화이트리스트 + 크기**: 확장자·MIME + 10MB 상한.
- **MIME 검증**: 매직 바이트 검사 권장(데모는 헤더 1차 검증).
- **`storage_path` 미노출**: 응답에 절대 포함 X (경로 추측 차단).
- **격리키**: `attachments`는 `company_id`, `workspace_id`, `project_id` 보유. 경로에 격리 식별자 포함.
- **Soft delete**: 메타 `is_deleted=true`. 파일 보존(정리 배치 Phase 2).
- **삭제 권한 (Rule 1·★16)**: `created_by = 요청자`(업로드자)만. 24h 윈도·PO 우회 폐기.

## 8. 예외 / 에러
| 상황 | 처리 | 에러 코드 |
| --- | --- | --- |
| 미인증 | 401 | `AUTH_UNAUTHORIZED` |
| Project 멤버 아님 | 403 | `AUTH_FORBIDDEN` |
| 미존재 Attachment | 404 | `ATTACH_NOT_FOUND` |
| 미존재 owner | 404 | `ATTACH_OWNER_NOT_FOUND` |
| 다른 Project owner | 400 | `ATTACH_CROSS_PROJECT_FORBIDDEN` |
| 확장자/MIME 거부 | 400 | `ATTACH_TYPE_NOT_ALLOWED` |
| 크기 초과 | 400 | `ATTACH_SIZE_EXCEEDED` |
| 삭제 권한 부족 | 403 | `AUTH_FORBIDDEN` |
| 비활성 Project | 403 | `PROJ_INACTIVE` |
| 입력 형식 오류 | 400 | `COMMON_INVALID_INPUT` |

## 9. 수용 기준 (Acceptance Criteria)
- [ ] **AC-1** Given Defect 상세 + PO/Member, When png 5MB 업로드, Then 200 + Attachment 메타.
- [ ] **AC-2** Given Viewer, When 업로드 시도, Then 403 `AUTH_FORBIDDEN`.
- [ ] **AC-3** Given 11MB 파일, When 업로드 시도, Then 400 `ATTACH_SIZE_EXCEEDED`.
- [ ] **AC-4** Given `.exe` 파일, When 업로드 시도, Then 400 `ATTACH_TYPE_NOT_ALLOWED`.
- [ ] **AC-5** Given 다른 Project Defect id로 ownerId 지정, When 업로드, Then 400 `ATTACH_CROSS_PROJECT_FORBIDDEN`.
- [ ] **AC-6** Given Project 멤버, When 다운로드, Then 200 + 파일 스트림 + Content-Disposition 원본명.
- [ ] **AC-7** Given Project 비멤버, When 다운로드 시도, Then 403 또는 404(은닉).
- [ ] **AC-8** Given 본인 업로드, When 삭제(시간 무관), Then 200 + `is_deleted=true`.
- [ ] **AC-9** Given **작성자 아닌 PO**, When 삭제 시도, Then 403 `AUTH_FORBIDDEN` (★16).
- [ ] **AC-10** Given **작성자 아닌 Member**, When 삭제 시도, Then 403 `AUTH_FORBIDDEN`.
- [ ] **AC-11** Given 응답 직렬화, When Attachment 반환, Then `storage_path` 미포함.
- [ ] **AC-12** Given 비활성 Project, When 업로드/다운로드, Then 403 `PROJ_INACTIVE`.

## 10. 추적성
| Requirement ID | 설명 | 관련 기능/화면 | 관련 API(개념) | 연관 TestCase |
| --- | --- | --- | --- | --- |
| REQ-ATTACH-001 | 첨부 업로드(확장자·크기·MIME 검증) | /projects/{id}/(runs\|defects)/{id} | `POST /attachments` | (QA) |
| REQ-ATTACH-002 | 첨부 목록 조회 | (상세 화면) | `GET /attachments?ownerType=...&ownerId=...` | (QA) |
| REQ-ATTACH-003 | 첨부 다운로드 | (상세 화면) | `GET /attachments/{id}/download` | (QA) |
| REQ-ATTACH-004 | 첨부 삭제(본인 24h 또는 PO) | (상세 화면) | `POST /attachments/{id}/delete` | (QA) |
| REQ-ATTACH-005 | 격리(같은 Project owner) | 전역 | (서비스 규칙) | (QA) |
| REQ-ATTACH-006 | `storage_path` 미노출 | 전역 | (DTO/직렬화) | (QA) |

## 11. 오픈 이슈 / 비고
- **S3 도입**: Phase 2. 로컬 디스크는 데모 한정.
- **다중 업로드(드래그 앤 드롭)**: Phase 2.
- **이미지 인라인 미리보기·썸네일**: Phase 2.
- **악성 코드 스캔**: AV 스캔 도입 Phase 2.
- **파일 정리 배치**: soft delete 된 파일 N일 후 물리 삭제 — Phase 2.
- **다운로드 권한 URL 만료**: Pre-signed URL은 S3 도입 시 결정 — Phase 2.
- **TC 첨부 확장**: 현재 owner=TestRun/Defect. TC 자체 첨부는 Phase 2.
