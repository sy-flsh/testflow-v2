import { apiError, apiSuccess } from "@/lib/api/response";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireCurrentWorkspace,
  requirePermission,
} from "@/lib/auth/guards";
import { getDashboardSummary } from "@/lib/reports/report-summary";

export const runtime = "nodejs";

export async function GET() {
  try {
    const auth = await requireCurrentWorkspace();
    requirePermission(auth, "read");

    const summary = await getDashboardSummary(auth.workspace.id);

    return apiSuccess(summary);
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("대시보드 요약을 불러오지 못했습니다.", 500, "DASHBOARD_SUMMARY_FAILED");
  }
}
