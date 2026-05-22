import { apiError, apiSuccess } from "@/lib/api/response";
import { deleteCurrentSession } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST() {
  try {
    await deleteCurrentSession();

    return apiSuccess({ ok: true });
  } catch (error) {
    console.error(error);
    return apiError("로그아웃을 처리하지 못했습니다.", 500, "AUTH_LOGOUT_FAILED");
  }
}
