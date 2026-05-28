import { apiError, apiSuccess } from "@/lib/api/response";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireCurrentWorkspace,
  requirePermission,
} from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import {
  createUniqueProjectSlug,
  mapProjectToDto,
  parseProjectStatus,
  toDbProjectStatus,
} from "@/lib/projects/project-api";
import { enforceCsrfProtection } from "@/lib/security/csrf";

export const runtime = "nodejs";

export async function GET() {
  try {
    const auth = await requireCurrentWorkspace();
    requirePermission(auth, "read");

    const projects = await prisma.project.findMany({
      where: { workspaceId: auth.workspace.id },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });

    return apiSuccess(projects.map(mapProjectToDto));
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("프로젝트 목록을 불러오지 못했습니다.", 500, "PROJECT_LIST_FAILED");
  }
}

export async function POST(request: Request) {
  try {
    const csrfError = enforceCsrfProtection(request);

    if (csrfError) {
      return csrfError;
    }

    const auth = await requireCurrentWorkspace();
    requirePermission(auth, "create");

    const body = await readJsonBody(request);
    const name = readTrimmedString(body.name);

    if (!name) {
      return apiError("프로젝트 이름을 입력하세요.", 400, "PROJECT_NAME_REQUIRED");
    }

    const status = parseProjectStatus(body.status) ?? "active";
    const slug = await createUniqueProjectSlug(
      auth.workspace.id,
      readTrimmedString(body.slug) || name,
    );

    const project = await prisma.project.create({
      data: {
        workspaceId: auth.workspace.id,
        name,
        slug,
        description: readTrimmedString(body.description),
        color: readTrimmedString(body.color) || "#2563EB",
        status: toDbProjectStatus(status),
      },
    });

    return apiSuccess(mapProjectToDto(project), { status: 201 });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("프로젝트를 생성하지 못했습니다.", 500, "PROJECT_CREATE_FAILED");
  }
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function readTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
