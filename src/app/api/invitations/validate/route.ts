import { apiError, apiSuccess } from "@/lib/api/response";
import { readJsonBody } from "@/lib/api/request";
import { hashInvitationToken } from "@/lib/company/invitations";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

/**
 * c8-2: 초대 token 검증(공개 — 미인증 신규 사용자도 호출).
 * POST /api/invitations/validate  body: { token }
 *
 * - raw token 은 응답/로그에 절대 노출하지 않는다. body 로 받아 SHA-256 hash 로만 조회.
 * - 정상 PENDING 초대일 때만 화면 표시용 최소 정보 반환.
 * - 만료된 PENDING 은 EXPIRED 로 전환 후 INVITE_EXPIRED.
 */
export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const token = typeof body.token === "string" ? body.token.trim() : "";

    if (!token) {
      return apiError("초대 토큰이 필요합니다.", 400, "INVITE_TOKEN_REQUIRED");
    }

    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash: hashInvitationToken(token) },
      include: {
        roles: { select: { scopeType: true, scopeId: true, role: true } },
        company: { select: { name: true } },
      },
    });

    if (!invitation) {
      return apiError("초대를 찾을 수 없습니다.", 404, "INVITE_NOT_FOUND");
    }

    // 만료된 PENDING → EXPIRED 전환(상태 정합성 유지).
    let status = invitation.status;

    if (status === "PENDING" && invitation.expiresAt.getTime() < Date.now()) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });
      status = "EXPIRED";
    }

    if (status === "EXPIRED") {
      return apiError("만료된 초대입니다.", 400, "INVITE_EXPIRED");
    }

    if (status === "REVOKED") {
      return apiError("취소된 초대입니다.", 400, "INVITE_REVOKED");
    }

    if (status === "ACCEPTED") {
      return apiError("이미 수락된 초대입니다.", 400, "INVITE_ALREADY_ACCEPTED");
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: invitation.email },
      select: { id: true },
    });

    return apiSuccess({
      invitationId: invitation.id,
      email: invitation.email,
      companyName: invitation.company.name,
      expiresAt: invitation.expiresAt.toISOString(),
      roles: invitation.roles.map((entry) => ({
        scopeType: entry.scopeType,
        scopeId: entry.scopeId,
        role: entry.role,
      })),
      existingUser: Boolean(existingUser),
    });
  } catch (error) {
    console.error(error);
    return apiError("초대 검증에 실패했습니다.", 500, "INVITE_VALIDATE_FAILED");
  }
}
