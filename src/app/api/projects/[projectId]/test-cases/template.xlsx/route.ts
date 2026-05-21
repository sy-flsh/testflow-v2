import ExcelJS from "exceljs";
import { apiError } from "@/lib/api/response";
import { findProjectForTestCaseApi } from "@/lib/testcases/testcase-api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

const headers = [
  "folder",
  "title",
  "description",
  "preconditions",
  "priority",
  "status",
  "tags",
  "step1_action",
  "step1_expected",
  "step2_action",
  "step2_expected",
  "step3_action",
  "step3_expected",
];

const exampleRows = [
  {
    folder: "결제하기",
    title: "신용카드 결제 성공 확인",
    description: "정상 카드 정보로 결제가 완료되는지 확인합니다.",
    preconditions: "로그인 완료, 장바구니에 상품 1개 이상 존재",
    priority: "high",
    status: "ready",
    tags: "payment, smoke",
    step1_action: "결제 페이지로 이동한다.",
    step1_expected: "결제 수단 선택 영역이 표시된다.",
    step2_action: "정상 카드 정보를 입력하고 결제 버튼을 클릭한다.",
    step2_expected: "결제 승인 요청이 처리된다.",
    step3_action: "완료 화면을 확인한다.",
    step3_expected: "주문번호와 결제 완료 메시지가 표시된다.",
  },
];

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const project = await findProjectForTestCaseApi(projectId);

    if (!project) {
      return apiError("프로젝트를 찾을 수 없습니다.", 404, "PROJECT_NOT_FOUND");
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("TestCases");

    worksheet.columns = headers.map((header) => ({
      header,
      key: header,
      width: Math.max(header.length + 2, 18),
    }));
    worksheet.addRows(exampleRows);
    worksheet.getRow(1).font = { bold: true };
    worksheet.views = [{ state: "frozen", ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${project.slug}-testcase-template.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(error);
    return apiError("템플릿 파일을 생성하지 못했습니다.", 500, "TEST_CASE_TEMPLATE_FAILED");
  }
}
