import { apiError, apiSuccess } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { parseCsvImport } from "@/lib/testcases/import-api";
import { findProjectForTestCaseApi } from "@/lib/testcases/testcase-api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const project = await findProjectForTestCaseApi(projectId);

    if (!project) {
      return apiError("프로젝트를 찾을 수 없습니다.", 404, "PROJECT_NOT_FOUND");
    }

    const csvText = await readCsvText(request);

    if (!csvText.trim()) {
      return apiError("CSV 파일 내용이 비어 있습니다.", 400, "TEST_CASE_IMPORT_EMPTY");
    }

    const folders = await prisma.testFolder.findMany({
      where: { projectId: project.id, deletedAt: null },
      select: { id: true, slug: true, name: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    const preview = parseCsvImport(csvText, folders);

    return apiSuccess(preview);
  } catch (error) {
    console.error(error);
    return apiError("CSV 미리보기를 생성하지 못했습니다.", 500, "TEST_CASE_IMPORT_PREVIEW_FAILED");
  }
}

async function readCsvText(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new Error("file 필드가 필요합니다.");
    }

    return file.text();
  }

  return request.text();
}
