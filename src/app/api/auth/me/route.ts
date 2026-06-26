import { apiError, apiSuccess } from "@/lib/api/response";
import { USER_ACCOUNT_DELETED_CODE, USER_ACCOUNT_DELETED_MESSAGE } from "@/lib/auth/account";
import { getUserWorkspaces, mapAuthPayload, resolveActiveMembership } from "@/lib/auth/me";
import { getRolesByScope, resolveWorkspaceAuthRole } from "@/lib/auth/roles";
import { getCurrentSession } from "@/lib/auth/session";
import {
  getInactiveCompanyIdsForUser,
  hasMembershipBlockedByInactiveCompany,
} from "@/lib/company/company-user-state";
import { prisma } from "@/lib/db/prisma";
import { recordSecurityAuditEvent } from "@/lib/security/audit-log";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return apiError("로그인이 필요합니다.", 401, "AUTH_UNAUTHORIZED");
    }

    // c10-1: 정상 탈퇴 시 세션을 모두 삭제하므로 보통 여기 도달하지 않지만,
    // 경쟁/stale 세션 방어 분기로 soft-deleted 계정은 USER_ACCOUNT_DELETED 로 응답한다(쿠키는 유지 →
    // AppShell 이 AccountDeleted 안내+로그인 이동을 노출). USER_INACTIVE 와 구분된다.
    if (session.user.deletedAt) {
      return apiError(USER_ACCOUNT_DELETED_MESSAGE, 403, USER_ACCOUNT_DELETED_CODE);
    }

    // c9-1: 비활성 Company 의 Workspace 는 활성 workspace 후보에서 제외(다른 ACTIVE Company 로 fallback).
    const inactiveCompanyIds = await getInactiveCompanyIdsForUser(session.userId);

    const membership = await resolveActiveMembership(
      session.userId,
      session.selectedWorkspaceId,
      inactiveCompanyIds,
    );

    if (!membership) {
      // c9-4: 활성 workspace 후보가 0인 사유 구분.
      //  - INACTIVE Company 때문에 제외된 ACTIVE 멤버십이 있으면 → 403 USER_INACTIVE(전용 안내 화면).
      //  - 그 외(멤버십 자체 없음 / Company-only CO 등)는 기존 계약대로 401 유지.
      if (await hasMembershipBlockedByInactiveCompany(session.userId, inactiveCompanyIds)) {
        await recordSecurityAuditEvent({
          eventType: "INACTIVE_COMPANY_ACCESS_DENIED",
          targetUserId: session.userId,
          // 비활성 사유 Company 1건(best-effort). 복수면 대표 1건만 기록.
          companyId: inactiveCompanyIds.values().next().value,
          guardName: "auth.me",
        });
        return apiError(
          "현재 Company에서 비활성화되어 접근할 수 없습니다. 관리자에게 문의해 주세요.",
          403,
          "USER_INACTIVE",
        );
      }

      // 접근 가능한 ACTIVE Company workspace 가 없음 → 기존 계약대로 401(미들웨어/UI 가 로그인으로 안내).
      return apiError("활성 워크스페이스 멤버십을 찾을 수 없습니다.", 401, "AUTH_UNAUTHORIZED");
    }

    if (session.selectedWorkspaceId !== membership.workspaceId) {
      await prisma.session.update({
        where: { id: session.id },
        data: { selectedWorkspaceId: membership.workspaceId },
      });
    }

    const workspaces = await getUserWorkspaces(session.userId, inactiveCompanyIds);
    const rolesByScope = await getRolesByScope(session.userId);
    // c5-2: 기존 role/permissions 계산도 UserRole(WORKSPACE) 우선으로 전환.
    // 값 자체는 Admin/Member/Viewer 그대로 유지(계약 불변), 산출 근거만 UserRole 우선.
    const workspaceAuthRole = await resolveWorkspaceAuthRole(
      session.userId,
      membership.workspaceId,
      membership.role,
    );

    return apiSuccess(
      mapAuthPayload({
        user: session.user,
        workspace: membership.workspace,
        role: membership.role,
        authRole: workspaceAuthRole,
        workspaces,
        rolesByScope,
      }),
    );
  } catch (error) {
    console.error(error);
    return apiError("현재 사용자 정보를 불러오지 못했습니다.", 500, "AUTH_ME_FAILED");
  }
}
