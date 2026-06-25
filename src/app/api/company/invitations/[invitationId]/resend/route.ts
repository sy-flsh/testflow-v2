import type { Prisma } from "@prisma/client";
import { apiError, apiSuccess } from "@/lib/api/response";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireCompanyOwner,
} from "@/lib/auth/guards";
import type {
  CompanyInvitationDto,
  InvitationRoleDto,
} from "@/lib/company/types";
import {
  buildInviteUrl,
  createInvitationToken,
  hashInvitationToken,
  invitationExpiresAt,
} from "@/lib/company/invitations";
import { prisma } from "@/lib/db/prisma";
import { enforceCsrfProtection } from "@/lib/security/csrf";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ invitationId: string }>;
};

/** 트랜잭션 내부 race 가드 등 상태 오류를 응답으로 매핑하기 위한 에러. */
class ResendError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ResendError";
  }
}

/**
 * c8-4: PENDING 초대 재발송.
 * POST /api/company/invitations/{invitationId}/resend
 *
 * - CO 만 접근 + CSRF 보호. 현재 Company 초대만 대상(타 Company/미존재 404 INVITE_NOT_FOUND).
 * - PENDING 만 재발송 가능(그 외 400 INVITE_NOT_PENDING, 만료 PENDING 은 EXPIRED 처리 후 거부).
 * - 단일 트랜잭션: 기존 PENDING → REVOKED, 새 Invitation(PENDING, 새 tokenHash, 24h) 생성 +
 *   기존 InvitationRole snapshot 복제. 새 raw token 은 inviteUrl 로만 1회 반환(DB 미저장).
 *
 * isolation: 기본(Read Committed). "마지막 CO" 같은 cross-row 불변식이 없고, 유일 제약은
 * 랜덤 tokenHash 뿐이라 Serializable 불필요. 트랜잭션 내 revoke 는 `where status=PENDING`
 * count 가드로 동시 재발송/취소 race 시 0 건이면 중단(부분 상태 방지).
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const csrfError = enforceCsrfProtection(request);

    if (csrfError) {
      return csrfError;
    }

    const { user: actor, companyId } = await requireCompanyOwner();
    const { invitationId } = await context.params;

    const existing = await prisma.invitation.findUnique({
      where: { id: invitationId },
      include: { roles: { select: { scopeType: true, scopeId: true, role: true } } },
    });

    if (!existing || existing.companyId !== companyId) {
      return apiError("초대를 찾을 수 없습니다.", 404, "INVITE_NOT_FOUND");
    }

    // 만료된 PENDING 은 EXPIRED 로 정리 후 재발송 거부(상태 정합성 유지).
    if (existing.status === "PENDING" && existing.expiresAt.getTime() < Date.now()) {
      await prisma.invitation.update({
        where: { id: existing.id },
        data: { status: "EXPIRED" },
      });

      return apiError("이미 만료된 초대입니다.", 400, "INVITE_NOT_PENDING");
    }

    if (existing.status !== "PENDING") {
      return apiError(
        "대기 중(PENDING) 상태의 초대만 재발송할 수 있습니다.",
        400,
        "INVITE_NOT_PENDING",
      );
    }

    const token = createInvitationToken();
    const tokenHash = hashInvitationToken(token);
    const expiresAt = invitationExpiresAt();

    let created;

    try {
      created = await prisma.$transaction(async (tx) => {
        // race 가드: PENDING 일 때만 REVOKED 처리. 0 건이면 동시 변경 → 중단(롤백).
        const revoked = await tx.invitation.updateMany({
          where: { id: existing.id, status: "PENDING" },
          data: { status: "REVOKED", revokedAt: new Date() },
        });

        if (revoked.count === 0) {
          throw new ResendError(
            "대기 중(PENDING) 상태의 초대만 재발송할 수 있습니다.",
            400,
            "INVITE_NOT_PENDING",
          );
        }

        return tx.invitation.create({
          data: {
            companyId: existing.companyId,
            email: existing.email,
            tokenHash,
            invitedByUserId: actor.id,
            expiresAt,
            roles: {
              // 기존 snapshot 그대로 복제(scopeType/scopeId/role 변경 금지).
              create: existing.roles.map((item) => ({
                scopeType: item.scopeType,
                scopeId: item.scopeId,
                role: item.role,
              })),
            },
          },
          include: {
            roles: { select: { scopeType: true, scopeId: true, role: true } },
            invitedBy: { select: { name: true, email: true } },
          },
        });
      });
    } catch (error) {
      if (error instanceof ResendError) {
        return apiError(error.message, error.status, error.code);
      }

      throw error;
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: existing.email },
      select: { id: true },
    });

    const dto = serializeInvitation(created, Boolean(existingUser));

    return apiSuccess({ invitation: dto, inviteUrl: buildInviteUrl(token) }, { status: 201 });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("초대 재발송에 실패했습니다.", 500, "INVITE_RESEND_FAILED");
  }
}

type InvitationWithRelations = Prisma.InvitationGetPayload<{
  include: {
    roles: { select: { scopeType: true; scopeId: true; role: true } };
    invitedBy: { select: { name: true; email: true } };
  };
}>;

function serializeInvitation(
  invitation: InvitationWithRelations,
  existingUser: boolean,
): CompanyInvitationDto {
  const roles: InvitationRoleDto[] = invitation.roles.map((entry) => ({
    scopeType: entry.scopeType,
    scopeId: entry.scopeId,
    role: entry.role,
  }));

  return {
    id: invitation.id,
    email: invitation.email,
    status: invitation.status,
    invitedBy: invitation.invitedBy
      ? { name: invitation.invitedBy.name, email: invitation.invitedBy.email }
      : null,
    createdAt: invitation.createdAt.toISOString(),
    expiresAt: invitation.expiresAt.toISOString(),
    roles,
    existingUser,
  };
}
