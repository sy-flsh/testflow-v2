# BE ErrorCode ↔ FE i18n 키 매핑 정본 (Error Code Mapping)

| 항목 | 내용 |
| --- | --- |
| 문서명 | BE ErrorCode ↔ FE i18n 키 매핑 정본 |
| 문서 버전 | v0.1 |
| 최초 작성일 | 2026-06-08 |
| 최종 개정일 | 2026-06-08 |
| 작성 주체 | Frontend·Backend 공동 |
| 문서 등급 | L1 (영역간 정합 정본) |
| 상위 문서 | `docs/standards/backend-coding-standard.md` §5.2 ErrorCode / `docs/design/00_design_system_v3.md` §6 i18n / `docs/standards/frontend-coding-standard.md` §12.7 i18n |
| 적용 범위 | BE 응답 `code` 필드 ↔ FE i18n 키 ↔ 디자인 정본 메시지 3자 매핑 |

> 본 문서는 **BE ErrorCode 단일 정본 ↔ FE i18n 키 단일 정본**의 매핑 정본이다. 누락 시 CI 게이트 차단.
> raw 문구는 `00_design_system_v3.md` §6 (validation/success) 및 본 문서 §3 (confirm/error toast)에서만 정의. 코드에는 키만.

---

## 1. 매핑 규칙 (락)

### 1.1 명명 변환 컨벤션

| BE ErrorCode (UPPER_SNAKE) | FE i18n 키 (dot.case) | 변환 규칙 |
| --- | --- | --- |
| `USER_NAME_REQUIRED` | `validation.name.required` | DOMAIN(`USER`) → 무시 (필드명이 도메인 식별) / 나머지 dot+lower |
| `USER_EMAIL_DUPLICATE` | `validation.email.duplicate` | 동일 |
| `AUTH_TOKEN_EXPIRED` | `error.auth.tokenExpired` | DOMAIN 단어 (도메인 식별 필요) → `error.<domain>.<reason>` |
| `COMMON_INVALID_INPUT` | `error.common.invalidInput` | COMMON → `error.common.*` |
| `COMMON_INTERNAL_ERROR` | `error.common.internal` | 500급 통일 |

> 변환은 컨벤션 우선 — 매핑표 행이 없어도 자동 매핑 가능. 본 표는 **예외/오버라이드만** 명시. 컨벤션 위반 시 본 표 갱신 필수.

### 1.2 응답 → FE 전이 흐름

```
BE 422/400/409/500 응답
  ↓ ApiResponse.code = "USER_EMAIL_DUPLICATE"
FE error handler (axios interceptor)
  ↓ 컨벤션 변환 → "validation.email.duplicate"
i18n 룩업 (locales/ko.json)
  ↓ "이미 사용 중인 이메일입니다."
표시 위치:
  - errors[] 배열 있음 (필드 단위) → 해당 필드 Input Error state + error text
  - errors[] 없음 (페이지 단위) → Toast (error variant) + 페이지 inline error (선택)
```

### 1.3 errors 배열 매핑

BE 응답 `errors[].field` + `errors[].reason` → FE 필드별 Error state 트리거.

```json
{
  "success": false,
  "code": "COMMON_INVALID_INPUT",
  "errors": [
    { "field": "email", "reason": "USER_EMAIL_DUPLICATE" },
    { "field": "name",  "reason": "USER_NAME_REQUIRED" }
  ]
}
```

→ 각 필드별 i18n 키: `validation.email.duplicate`, `validation.name.required`.

> `errors[].reason`은 ErrorCode 또는 i18n 키 양쪽 허용. ErrorCode 권장 (BE/FE 단일 정본).

---

## 2. 매핑 표 — Validation (필드 단위, 422)

> `00_design_system_v3.md` §6.1 i18n 정본과 1:1 매핑. raw 문구는 §6.1만 정본.

| BE ErrorCode | FE i18n 키 | 표시 위치 |
| --- | --- | --- |
| `USER_NAME_REQUIRED` | `validation.name.required` | Input Error state + error text |
| `USER_EMAIL_REQUIRED` | `validation.email.required` | Input Error state |
| `USER_EMAIL_FORMAT` | `validation.email.format` | Input Error state |
| `USER_EMAIL_DUPLICATE` | `validation.email.duplicate` | Input Error state |
| `USER_USERNAME_REQUIRED` | `validation.username.required` | Input Error state |
| `USER_USERNAME_FORMAT` | `validation.username.format` | Input Error state |
| `USER_USERNAME_DUPLICATE` | `validation.username.duplicate` | Input Error state |
| `USER_PASSWORD_FORMAT` | `validation.password.format` | Input Error state |
| `USER_PASSWORD_CONFIRM_MISMATCH` | `validation.passwordConfirm.mismatch` | Input Error state |
| `USER_ROLE_REQUIRED` | `validation.role.required` | Select Error state |

### 2.1 도메인별 확장 패턴

| 도메인 | 패턴 | 예 |
| --- | --- | --- |
| Project | `PROJECT_<FIELD>_<RULE>` ↔ `validation.<field>.<rule>` | `PROJECT_NAME_REQUIRED` ↔ `validation.name.required` (공용 field 키 재사용) |
| Workspace | `WORKSPACE_<FIELD>_<RULE>` ↔ 동일 | |
| TestCase | `TESTCASE_<FIELD>_<RULE>` ↔ 동일 | `TESTCASE_TITLE_REQUIRED` ↔ `validation.title.required` |

> 동일 필드명(`name`, `email`, `title` 등)은 도메인 무관하게 **단일 i18n 키 재사용**. 도메인별 차이 발생 시 키에 도메인 추가 (`validation.project.name.required`).

---

## 3. 매핑 표 — Domain 비즈니스 에러 (400/403/404/409)

> 페이지 단위 (errors[] 없음). Toast 또는 inline error 표시.

| BE ErrorCode | HTTP | FE i18n 키 | 표시 |
| --- | --- | --- | --- |
| `COMPANY_NOT_FOUND` | 404 | `error.company.notFound` | Toast + 404 페이지 fallback |
| `COMPANY_INACTIVE` | 403 | `error.company.inactive` | Toast + 강제 logout |
| `COMPANY_TRANSFER_TARGET_NOT_CO` | 400 | `error.company.transferTargetNotCo` | Toast |
| `WORKSPACE_NOT_FOUND` | 404 | `error.workspace.notFound` | Toast + 404 |
| `WORKSPACE_LAST_OWNER` | 409 | `error.workspace.lastOwner` | Toast |
| `PROJECT_NOT_FOUND` | 404 | `error.project.notFound` | Toast + 404 |
| `PROJECT_CODE_DUPLICATE` | 409 | `validation.code.duplicate` | Input Error state (form 컨텍스트) |
| `TESTCASE_NOT_FOUND` | 404 | `error.testcase.notFound` | Toast |
| `TESTCASE_DELETE_NOT_AUTHOR` | 403 | `error.testcase.deleteNotAuthor` | Toast (Rule 1 / ★16) |
| `TESTCASE_SCOPE_VIOLATION` | 403 | `error.testcase.scopeViolation` | Toast |
| `TESTRUN_NOT_FOUND` | 404 | `error.testrun.notFound` | Toast |
| `TESTRUN_ALREADY_COMPLETED` | 409 | `error.testrun.alreadyCompleted` | Toast |
| `DEFECT_NOT_FOUND` | 404 | `error.defect.notFound` | Toast |
| `DEFECT_INVALID_STATUS_TRANSITION` | 409 | `error.defect.invalidStatusTransition` | Toast |
| `ATTACHMENT_TOO_LARGE` | 413 | `error.attachment.tooLarge` | Toast (FileUpload Error state) |
| `ATTACHMENT_INVALID_TYPE` | 400 | `error.attachment.invalidType` | Toast (FileUpload Error state) |

---

## 4. 매핑 표 — Auth (401/403)

| BE ErrorCode | HTTP | FE i18n 키 | 표시 |
| --- | --- | --- | --- |
| `AUTH_UNAUTHORIZED` | 401 | `error.auth.unauthorized` | 강제 로그인 페이지 이동 |
| `AUTH_TOKEN_EXPIRED` | 401 | `error.auth.tokenExpired` | Toast + 로그인 페이지 이동 |
| `AUTH_TOKEN_INVALID` | 401 | `error.auth.tokenInvalid` | Toast + 로그인 페이지 이동 |
| `AUTH_FORBIDDEN` | 403 | `error.auth.forbidden` | Toast + 이전 페이지 유지 |
| `AUTH_PASSWORD_MISMATCH` | 401 | `validation.password.mismatch` | Input Error state (로그인 폼) |
| `AUTH_INVITE_TOKEN_EXPIRED` | 410 | `error.auth.inviteExpired` | 새 화면 (초대 만료 안내) |
| `AUTH_INVITE_TOKEN_INVALID` | 400 | `error.auth.inviteInvalid` | 새 화면 (초대 무효 안내) |
| `AUTH_EMAIL_NOT_VERIFIED` | 403 | `error.auth.emailNotVerified` | 새 화면 (이메일 인증 재발송 CTA) |
| `AUTH_PASSWORD_RESET_TOKEN_EXPIRED` | 410 | `error.auth.resetExpired` | 새 화면 |

---

## 5. 매핑 표 — 공통 (5xx)

| BE ErrorCode | HTTP | FE i18n 키 | 표시 |
| --- | --- | --- | --- |
| `COMMON_INVALID_INPUT` | 400 | `error.common.invalidInput` | errors[] 있으면 필드 매핑, 없으면 Toast |
| `COMMON_INTERNAL_ERROR` | 500 | `error.common.internal` | Toast + 재시도 CTA |
| `COMMON_SERVICE_UNAVAILABLE` | 503 | `error.common.unavailable` | Toast + 자동 재시도 (지수 백오프) |
| `COMMON_RATE_LIMIT` | 429 | `error.common.rateLimit` | Toast |

---

## 6. i18n 키 정본 — error.*

> `00_design_system_v3.md` §6.1은 `validation.*` / `success.*` 정본. 본 §6은 `error.*` 정본을 보완. (i18n 정본을 design system §6 또는 본 문서로 분산해야 하는지 결정은 §9 운영 규칙.)

| i18n 키 | ko | en |
| --- | --- | --- |
| `error.common.invalidInput` | 입력값이 올바르지 않습니다. | The input is invalid. |
| `error.common.internal` | 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요. | Something went wrong. Please try again. |
| `error.common.unavailable` | 서비스가 일시적으로 이용 불가합니다. | Service is temporarily unavailable. |
| `error.common.rateLimit` | 요청이 너무 많습니다. 잠시 후 다시 시도해주세요. | Too many requests. Please try again later. |
| `error.auth.unauthorized` | 인증이 필요합니다. | Authentication required. |
| `error.auth.tokenExpired` | 세션이 만료되었습니다. 다시 로그인해주세요. | Session expired. Please log in again. |
| `error.auth.tokenInvalid` | 유효하지 않은 세션입니다. | Invalid session. |
| `error.auth.forbidden` | 권한이 없습니다. | Permission denied. |
| `error.auth.inviteExpired` | 초대 링크가 만료되었습니다. | Invitation link has expired. |
| `error.auth.inviteInvalid` | 유효하지 않은 초대 링크입니다. | Invalid invitation link. |
| `error.auth.emailNotVerified` | 이메일 인증이 필요합니다. | Email verification required. |
| `error.auth.resetExpired` | 비밀번호 재설정 링크가 만료되었습니다. | Password reset link has expired. |
| `error.company.notFound` | 회사를 찾을 수 없습니다. | Company not found. |
| `error.company.inactive` | 비활성 상태의 회사입니다. | This company is inactive. |
| `error.company.transferTargetNotCo` | 이관 대상이 CO가 아닙니다. | Target user is not a Company Owner. |
| `error.workspace.notFound` | 워크스페이스를 찾을 수 없습니다. | Workspace not found. |
| `error.workspace.lastOwner` | 마지막 소유자는 제거할 수 없습니다. | Cannot remove the last owner. |
| `error.project.notFound` | 프로젝트를 찾을 수 없습니다. | Project not found. |
| `error.testcase.notFound` | 테스트 케이스를 찾을 수 없습니다. | Test case not found. |
| `error.testcase.deleteNotAuthor` | 작성자만 삭제할 수 있습니다. | Only the author can delete this. |
| `error.testcase.scopeViolation` | 다른 Scope의 자원에 접근할 수 없습니다. | Cannot access resources from a different scope. |
| `error.testrun.notFound` | 테스트 실행을 찾을 수 없습니다. | Test run not found. |
| `error.testrun.alreadyCompleted` | 이미 완료된 테스트 실행입니다. | This test run is already completed. |
| `error.defect.notFound` | 결함을 찾을 수 없습니다. | Defect not found. |
| `error.defect.invalidStatusTransition` | 허용되지 않은 상태 전이입니다. | Invalid status transition. |
| `error.attachment.tooLarge` | 파일 크기가 너무 큽니다. (최대 10MB) | File too large (max 10MB). |
| `error.attachment.invalidType` | 지원하지 않는 파일 형식입니다. | Unsupported file type. |

---

## 7. i18n 키 정본 — confirm.*

> ConfirmDialog 정본. `components/confirm-dialog.md` §5 키 패턴 정합.

| i18n 키 | ko | en | Variant |
| --- | --- | --- | --- |
| `confirm.workspace.deactivate.title` | 워크스페이스 비활성화 | Deactivate Workspace | Destructive |
| `confirm.workspace.deactivate.body` | 비활성 후에는 멤버가 접근할 수 없습니다. 계속하시겠습니까? | Members will lose access. Continue? | |
| `confirm.workspace.deactivate.cta` | 비활성 | Deactivate | |
| `confirm.workspace.transfer.title` | 소유자 이관 | Transfer Ownership | Warning |
| `confirm.workspace.transfer.body` | 본인의 소유 권한이 대상자에게 이관됩니다. | Your ownership will be transferred. | |
| `confirm.workspace.transfer.cta` | 이관 | Transfer | |
| `confirm.project.deactivate.title` | 프로젝트 비활성화 | Deactivate Project | Destructive |
| `confirm.project.deactivate.body` | 비활성 후에는 모든 멤버가 접근할 수 없습니다. | All members will lose access. | |
| `confirm.project.deactivate.cta` | 비활성 | Deactivate | |
| `confirm.testcase.delete.title` | 테스트 케이스 삭제 | Delete Test Case | Destructive |
| `confirm.testcase.delete.body` | 작성자만 삭제할 수 있으며 되돌릴 수 없습니다. | Only the author can delete. This cannot be undone. | |
| `confirm.testcase.delete.cta` | 삭제 | Delete | |
| `confirm.testsuite.delete.title` | 테스트 스위트 삭제 | Delete Test Suite | Destructive |
| `confirm.testsuite.delete.body` | 빈 스위트만 삭제할 수 있습니다. 계속하시겠습니까? | Only empty suites can be deleted. Continue? | |
| `confirm.testsuite.delete.cta` | 삭제 | Delete | |
| `confirm.testplan.archive.title` | 테스트 계획 보관 | Archive Test Plan | Warning |
| `confirm.testplan.archive.body` | 보관 후 편집할 수 없습니다. | Cannot be edited after archiving. | |
| `confirm.testplan.archive.cta` | 보관 | Archive | |
| `confirm.testrun.complete.title` | 테스트 실행 완료 처리 | Complete Test Run | Warning |
| `confirm.testrun.complete.body` | 완료 후에는 결과를 수정할 수 없습니다. | Results cannot be edited after completion. | |
| `confirm.testrun.complete.cta` | 완료 | Complete | |
| `confirm.defect.close.title` | 결함 종료 | Close Defect | Warning |
| `confirm.defect.close.body` | 종료 후 재오픈만 가능합니다. | Can only be reopened after closing. | |
| `confirm.defect.close.cta` | 종료 | Close | |
| `confirm.user.remove.title` | 멤버 제거 | Remove Member | Destructive |
| `confirm.user.remove.body` | 제거된 멤버는 워크스페이스/프로젝트에 접근할 수 없습니다. | Removed members will lose access. | |
| `confirm.user.remove.cta` | 제거 | Remove | |
| `confirm.user.passwordReset.title` | 비밀번호 재설정 메일 발송 | Send Password Reset Email | Warning |
| `confirm.user.passwordReset.body` | 대상자에게 임시 비밀번호 메일을 발송합니다. | A temporary password email will be sent. | |
| `confirm.user.passwordReset.cta` | 발송 | Send | |
| `confirm.user.grantCo.title` | CO 권한 부여 | Grant CO Role | Warning |
| `confirm.user.grantCo.body` | CO 권한을 부여하면 전체 회사 관리 권한을 갖습니다. | The user will gain full company management permissions. | |
| `confirm.user.grantCo.cta` | 부여 | Grant | |
| `confirm.common.discard.title` | 변경사항을 버리시겠습니까? | Discard Changes? | Discard |
| `confirm.common.discard.body` | 저장하지 않은 변경사항이 사라집니다. | Unsaved changes will be lost. | |
| `confirm.common.discard.cta` | 버리기 | Discard | |
| `confirm.common.cancel` | 취소 | Cancel | (모든 dialog 공용 기본 cancel 라벨) |

---

## 8. Toast 메시지 정본 — success.*

| i18n 키 | ko | en | Variant |
| --- | --- | --- | --- |
| `success.common.saved` | 저장되었습니다. | Saved. | success |
| `success.common.created` | 생성되었습니다. | Created. | success |
| `success.common.updated` | 수정되었습니다. | Updated. | success |
| `success.common.deleted` | 삭제되었습니다. | Deleted. | success |
| `success.common.copied` | 복사되었습니다. | Copied. | info |
| `success.auth.passwordReset` | 비밀번호 재설정 메일을 발송했습니다. | Password reset email sent. | success |
| `success.auth.inviteSent` | 초대 메일을 발송했습니다. | Invitation email sent. | success |
| `success.testrun.completed` | 테스트 실행이 완료되었습니다. | Test run completed. | success |

---

## 9. 운영 규칙

1. **단일 정본 분리** (락):
   - **Validation/Success raw 문구** = `00_design_system_v3.md` §6.1 (디자이너 정본)
   - **Error/Confirm raw 문구** = 본 문서 §6/§7/§8 (FE·BE 정합 정본)
   - 정합성 자동 검증 스크립트: `scripts/sync-i18n-from-design.ts` (예정)
2. **BE ErrorCode 추가/변경 절차**:
   - `backend-coding-standard.md` §5.2 enum 갱신 → 본 문서 §2~§5 매핑 추가 PR → 머지 → locale JSON 추출
   - 매핑 누락 시 FE는 자동 컨벤션 변환 fallback (§1.1) — 단, CI 게이트 경고
3. **CI 게이트**:
   - BE enum ↔ 본 문서 §2~§5 drift 검증 (없으면 빌드 실패)
   - 본 문서 §6~§8 ↔ `locales/ko.json`·`en.json` drift 검증
   - i18n 키 미사용 / 코드 raw 문구 하드코딩 검증 (ESLint `i18next/no-literal-string`)
4. **코드는 i18n 키만**:
   - FE: `t('validation.email.duplicate')` — raw 문구 금지
   - BE: ErrorCode enum의 `message` 필드는 **fallback only** (FE 없을 때 + 로그·관리자 메일용). 클라이언트는 `code` 기준 i18n 룩업.

---

## 10. 변경 이력

| 버전 | 일자 | 변경 |
| --- | --- | --- |
| v0.1 | 2026-06-08 | 초안. 매핑 규칙 (컨벤션 변환 + errors[] 매핑) 락. Validation 10건 + Domain 16건 + Auth 9건 + Common 4건 정본. `error.*` i18n 27건, `confirm.*` 36건, `success.*` 8건 신설. 운영 규칙 4종 (단일 정본 분리, BE 갱신 절차, CI 게이트 3종, 코드 i18n 키 강제). |
