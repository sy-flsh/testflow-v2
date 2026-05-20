import { apiError, apiSuccess } from "@/lib/api/response";
import { getProjectReportSummary } from "@/lib/reports/report-summary";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const searchParams = new URL(request.url).searchParams;
    const summary = await getProjectReportSummary(projectId, {
      period: searchParams.get("period") ?? undefined,
      plan: searchParams.get("plan") ?? undefined,
      assignee: searchParams.get("assignee") ?? undefined,
      environment: searchParams.get("environment") ?? undefined,
    });

    if (!summary) {
      return apiError("프로젝트를 찾을 수 없습니다.", 404, "PROJECT_NOT_FOUND");
    }

    return apiSuccess(summary);
  } catch (error) {
    console.error(error);
    return apiError("보고서 요약을 불러오지 못했습니다.", 500, "REPORT_SUMMARY_FAILED");
  }
}
