import { createHash, randomBytes } from "node:crypto";

/**
 * c8-1: Company 초대 토큰/만료 helper.
 * - raw token 은 DB 에 저장하지 않고 SHA-256 hash 만 보관한다(session.ts 와 동일 패턴).
 * - inviteUrl(raw token 포함)은 생성 응답에서만 1회 반환한다.
 */

/** 초대 토큰 유효기간: 생성 시점 기준 24시간. */
export const INVITATION_TTL_MS = 24 * 60 * 60 * 1000;

/** crypto 기반 충분히 긴 랜덤 토큰(raw). DB 저장 금지. */
export function createInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

/** raw token → DB 저장용 SHA-256 hex hash. */
export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** 개발용 초대 수락 URL. 수락 라우트/UI 는 c8-2 범위(여기서는 URL 문자열만 생성). */
export function buildInviteUrl(token: string): string {
  return `/invite/accept?token=${encodeURIComponent(token)}`;
}

/** 생성 시점 기준 만료 시각. */
export function invitationExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + INVITATION_TTL_MS);
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** email 정규화(trim + lowercase) + 형식 검증. 실패 시 null. */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }

  const email = raw.trim().toLowerCase();

  if (!email || email.length > 254 || !EMAIL_REGEX.test(email)) {
    return null;
  }

  return email;
}
