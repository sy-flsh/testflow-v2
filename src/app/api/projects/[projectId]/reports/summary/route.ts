import { apiError, apiSuccess } from "@/lib/api/response";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireProjectAccess,
} from "@/lib/auth/guards";
import { getProjectReportSummary } from "@/lib/reports/report-summary";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const auth = await requireProjectAccess(projectId, "read");
    const searchParams = new URL(request.url).searchParams;
    const summary = await getProjectReportSummary(auth.project.id, {
      period: searchParams.get("period") ?? undefined,
      plan: searchParams.get("plan") ?? undefined,
      assignee: searchParams.get("assignee") ?? undefined,
      environment: searchParams.get("environment") ?? undefined,
    });

    return apiSuccess(summary);
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("보고서 요약을 불러오지 못했습니다.", 500, "REPORT_SUMMARY_FAILED");
  }
}
