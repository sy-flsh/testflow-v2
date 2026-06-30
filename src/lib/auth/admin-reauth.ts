import { prisma } from "@/lib/db/prisma";

/**
 * c10-5: MasterAdmin step-up 재인증(현재 Session 한정 elevation).
 *
 * - elevation 은 Session.adminReauthenticatedAt + TTL(15분) 동안만 유효하다(고정 만료, 자동 연장 없음).
 * - 권한 판단의 최종 기준은 서버(이 helper)이며, 클라이언트 타이머는 UX 보조일 뿐이다.
 * - elevation 부여는 현재 Session 의 timestamp 만 갱신한다(새 Session/cookie/token 변경 없음).
 * - MasterAdmin 여부 판정(DB MasterAdmin)과 reauth 여부는 분리한다.
 */

export const ADMIN_REAUTH_TTL_MS = 15 * 60 * 1000;
export const ADMIN_REAUTH_REQUIRED_CODE = "ADMIN_REAUTH_REQUIRED";
export const ADMIN_REAUTH_REQUIRED_MESSAGE =
  "관리자 작업을 계속하려면 비밀번호를 다시 확인해 주세요.";

type ReauthSession = { adminReauthenticatedAt: Date | null };

/** elevation 만료 시각(미인증이면 null). */
export function getAdminReauthExpiresAt(session: ReauthSession): Date | null {
  if (!session.adminReauthenticatedAt) {
    return null;
  }
  return new Date(session.adminReauthenticatedAt.getTime() + ADMIN_REAUTH_TTL_MS);
}

/** 현재 시각 기준 elevation 이 유효한지. */
export function isAdminReauthValid(session: ReauthSession, now: Date = new Date()): boolean {
  const expiresAt = getAdminReauthExpiresAt(session);
  return expiresAt !== null && expiresAt.getTime() > now.getTime();
}

/**
 * 현재 Session 한 건의 adminReauthenticatedAt 만 now 로 갱신(다른 Session 불변).
 * @returns 부여 시각(now). 만료 시각은 now + TTL.
 */
export async function refreshAdminReauthentication(sessionId: string): Promise<Date> {
  const now = new Date();
  await prisma.session.update({
    where: { id: sessionId },
    data: { adminReauthenticatedAt: now },
  });
  return now;
}
