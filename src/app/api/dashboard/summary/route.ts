import { apiError, apiSuccess } from "@/lib/api/response";
import { getDashboardSummary } from "@/lib/reports/report-summary";

export const runtime = "nodejs";

export async function GET() {
  try {
    const summary = await getDashboardSummary();

    return apiSuccess(summary);
  } catch (error) {
    console.error(error);
    return apiError("대시보드 요약을 불러오지 못했습니다.", 500, "DASHBOARD_SUMMARY_FAILED");
  }
}
