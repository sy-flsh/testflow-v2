#!/usr/bin/env node

import "dotenv/config";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
// c9-9: audit 화면 순수 URL/필터 helper(브라우저 의존성 없음) — unit 수준 검증.
import {
  activePreset,
  buildActiveChips,
  exportButtonLabel,
  presetPatch,
  toggleEventTypePatch,
} from "../src/lib/company/security-audit-url.mjs";
// c10-2: admin 탈퇴 계정 목록 필터 정규화(순수 함수) — unit 검증용.
import {
  adminDeletedFilterPatch,
  normalizeAdminDeletedPage,
  normalizeAdminDeletedQuery,
  normalizeAdminDeletedSize,
  normalizeAdminDeletedSort,
} from "../src/lib/admin/admin-deleted-filters.mjs";
// c10-3: 전역 보안 감사 콘솔 순수 URL/필터 helper — unit 검증용.
import {
  activePreset as adminActivePreset,
  adminPresetPatch,
  buildAdminActiveChips,
  exportButtonLabel as adminExportButtonLabel,
  toggleAdminEventTypePatch,
} from "../src/lib/admin/admin-security-audit-url.mjs";

const PORT = process.env.TESTFLOW_TEST_PORT || "3210";
const BASE_URL = process.env.TESTFLOW_BASE_URL || `http://127.0.0.1:${PORT}`;
const BASE_ORIGIN = new URL(BASE_URL).origin;
const EXTERNAL_SERVER = process.env.TESTFLOW_EXTERNAL_SERVER === "1";
const PASSWORD = "password123!";
const RUN_ID = `${Date.now()}`;
// c9-8: CSV export 안전 상한을 테스트에서 작게 고정(422 경로를 10001건 없이 검증). 서버가 상속.
process.env.SECURITY_AUDIT_EXPORT_LIMIT = "5";

const accounts = {
  admin: "qa.lead@testflow.local",
  member: "backend@testflow.local",
  viewer: "pm@testflow.local",
};

let serverProcess = null;
let serverLogs = "";

class CookieJar {
  cookies = new Map();

  header() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  store(headers) {
    for (const cookie of getSetCookieValues(headers)) {
      const pair = cookie.split(";")[0] ?? "";
      const separatorIndex = pair.indexOf("=");

      if (separatorIndex <= 0) {
        continue;
      }

      const name = pair.slice(0, separatorIndex).trim();
      const value = pair.slice(separatorIndex + 1);

      if (!value) {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, value);
      }
    }
  }
}

function getSetCookieValues(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const header = headers.get("set-cookie");

  if (!header) {
    return [];
  }

  return header
    .split(/,(?=\s*[^;,]+=)/g)
    .map((value) => value.trim())
    .filter(Boolean);
}

async function request(path, options = {}) {
  const {
    method = "GET",
    body,
    headers = {},
    jar,
    redirect = "follow",
    expectedStatus,
  } = options;
  const requestHeaders = { ...headers };
  const cookieHeader = jar?.header();
  const methodName = method.toUpperCase();
  const init = {
    method: methodName,
    headers: requestHeaders,
    redirect,
  };

  if (
    isUnsafeMethod(methodName) &&
    !hasHeader(requestHeaders, "origin") &&
    !hasHeader(requestHeaders, "referer")
  ) {
    requestHeaders.Origin = BASE_ORIGIN;
  }

  if (cookieHeader) {
    requestHeaders.Cookie = cookieHeader;
  }

  if (body !== undefined) {
    if (
      typeof body === "string" ||
      body instanceof Uint8Array ||
      body instanceof ArrayBuffer
    ) {
      init.body = body;
    } else {
      requestHeaders["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
  }

  const response = await fetch(new URL(path, BASE_URL), init);
  jar?.store(response.headers);
  const text = await response.text();
  const json = parseJson(text);

  if (expectedStatus !== undefined && response.status !== expectedStatus) {
    throw new Error(
      `${method} ${path} expected ${expectedStatus}, got ${response.status}: ${text.slice(
        0,
        800,
      )}`,
    );
  }

  return { response, status: response.status, text, json };
}

function parseJson(text) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isUnsafeMethod(method) {
  return method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
}

function hasHeader(headers, name) {
  return Object.keys(headers).some((key) => key.toLowerCase() === name);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function check(label, fn) {
  await fn();
  console.log(`PASS ${label}`);
}

// c5-3: UserRole-first 권한 전환을 입증하기 위한 테스트 전용 DB 접근.
// 런타임 코드/seed 는 건드리지 않고, 테스트 내부에서 임시 데이터 변경 → 검증 → 복원(try/finally)에만 사용한다.
let prismaClient = null;

function getPrisma() {
  if (!prismaClient) {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error("DATABASE_URL 환경 변수가 필요합니다 (UserRole-first smoke 검증).");
    }

    prismaClient = new PrismaClient({ adapter: new PrismaPg(databaseUrl) });
  }

  return prismaClient;
}

async function disconnectPrisma() {
  if (prismaClient) {
    await prismaClient.$disconnect();
    prismaClient = null;
  }
}

// 역할 assertion 없이 로그인만 수행(전환 기간 동안 login 응답은 MemberRole 기반이라
// /api/auth/me 와 값이 다를 수 있으므로 role 검증은 호출부에서 /api/auth/me 로 한다).
async function loginRaw(email) {
  const jar = new CookieJar();
  await request("/api/auth/login", {
    method: "POST",
    body: { email, password: PASSWORD },
    jar,
    expectedStatus: 200,
  });
  assert(jar.cookies.has("tf_session"), `${email} did not receive tf_session`);
  return jar;
}

async function login(email, expectedRole, options = {}) {
  const jar = new CookieJar();
  const result = await request("/api/auth/login", {
    method: "POST",
    body: { email, password: PASSWORD },
    jar,
    headers: options.headers,
    expectedStatus: 200,
  });

  assert(jar.cookies.has("tf_session"), `${email} did not receive tf_session`);
  assert(result.json?.data?.role === expectedRole, `${email} role mismatch`);

  return jar;
}

async function expectStatus(label, path, expectedStatus, options = {}) {
  await check(label, async () => {
    await request(path, {
      ...options,
      expectedStatus,
    });
  });
}

async function startServer() {
  if (EXTERNAL_SERVER) {
    return;
  }

  serverProcess = spawn(
    "npm",
    ["run", "dev", "--", "--hostname", "127.0.0.1", "-p", PORT],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT,
        OPENAI_API_KEY:
          process.env.TESTFLOW_SMOKE_USE_OPENAI === "1" ? process.env.OPENAI_API_KEY : "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  serverProcess.stdout.on("data", (chunk) => {
    serverLogs += chunk.toString();
  });
  serverProcess.stderr.on("data", (chunk) => {
    serverLogs += chunk.toString();
  });

  await waitForServer();
}

async function waitForServer() {
  const deadline = Date.now() + 45_000;
  let lastError = null;

  while (Date.now() < deadline) {
    if (serverProcess?.exitCode !== null) {
      throw new Error(
        `Next dev server exited early with code ${serverProcess.exitCode}\n${serverLogs}`,
      );
    }

    try {
      const response = await fetch(new URL("/login", BASE_URL), {
        redirect: "manual",
      });

      if (response.status < 500) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await sleep(500);
  }

  throw new Error(
    `Timed out waiting for ${BASE_URL}\n${lastError?.message ?? ""}\n${serverLogs}`,
  );
}

async function stopServer() {
  if (!serverProcess) {
    return;
  }

  if (serverProcess.exitCode !== null) {
    return;
  }

  serverProcess.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => serverProcess.once("exit", resolve)),
    sleep(5_000).then(() => {
      if (serverProcess.exitCode === null) {
        serverProcess.kill("SIGKILL");
      }
    }),
  ]);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  let adminJar = null;
  const cleanup = {
    projects: [],
    testCases: [],
    runs: [],
    defects: [],
  };

  await startServer();

  try {
    await check("unauthenticated page request redirects to login with next", async () => {
      const result = await request("/dashboard", {
        redirect: "manual",
        expectedStatus: 307,
      });
      const location = result.response.headers.get("location") ?? "";
      assert(
        location.includes("/login?next=%2Fdashboard"),
        `Unexpected redirect location: ${location}`,
      );
    });

    await expectStatus("login page is public", "/login", 200);
    await expectStatus("signup page is public", "/signup", 200);

    for (const path of [
      "/api/projects",
      "/api/dashboard/summary",
      "/api/projects/demo-project/reports/summary",
      "/api/projects/demo-project/test-cases",
      "/api/projects/demo-project/runs",
      "/api/projects/demo-project/defects",
    ]) {
      await expectStatus(`unauthenticated ${path} returns 401`, path, 401);
    }

    await check("cross-origin login is rejected by CSRF guard", async () => {
      const result = await request("/api/auth/login", {
        method: "POST",
        headers: { Origin: "https://evil.example" },
        body: { email: accounts.admin, password: PASSWORD },
        expectedStatus: 403,
      });

      assert(result.json?.error?.code === "CSRF_FORBIDDEN", "Expected CSRF_FORBIDDEN");
    });

    await check("login email failure rate limit returns 429 and resets on success", async () => {
      const headers = { "X-Forwarded-For": `203.0.113.10` };

      for (let index = 0; index < 5; index += 1) {
        await request("/api/auth/login", {
          method: "POST",
          headers,
          body: { email: accounts.admin, password: `wrong-${index}` },
          expectedStatus: 401,
        });
      }

      const limited = await request("/api/auth/login", {
        method: "POST",
        headers,
        body: { email: accounts.admin, password: "wrong-limited" },
        expectedStatus: 429,
      });

      assert(limited.json?.error?.code === "RATE_LIMITED", "Expected RATE_LIMITED");

      const successJar = await login(accounts.admin, "Admin", { headers });

      await request("/api/auth/login", {
        method: "POST",
        headers,
        body: { email: accounts.admin, password: "wrong-after-reset" },
        expectedStatus: 401,
      });
      await request("/api/auth/logout", {
        method: "POST",
        headers,
        jar: successJar,
        expectedStatus: 200,
      });
    });

    await check("login IP rate limit returns 429", async () => {
      const headers = { "X-Forwarded-For": `203.0.113.20` };

      for (let index = 0; index < 10; index += 1) {
        await request("/api/auth/login", {
          method: "POST",
          headers,
          body: {
            email: `ip-limit-${RUN_ID}-${index}@testflow.local`,
            password: "wrong-password",
          },
          expectedStatus: 401,
        });
      }

      const limited = await request("/api/auth/login", {
        method: "POST",
        headers,
        body: {
          email: `ip-limit-${RUN_ID}-limited@testflow.local`,
          password: "wrong-password",
        },
        expectedStatus: 429,
      });

      assert(limited.json?.error?.code === "RATE_LIMITED", "Expected RATE_LIMITED");
    });

    await check("signup IP rate limit returns 429", async () => {
      const headers = { "X-Forwarded-For": `203.0.113.30` };

      for (let index = 0; index < 5; index += 1) {
        await request("/api/auth/signup", {
          method: "POST",
          headers,
          body: {
            name: "",
            email: `signup-limit-${RUN_ID}-${index}@testflow.local`,
            password: "short",
          },
          expectedStatus: 400,
        });
      }

      const limited = await request("/api/auth/signup", {
        method: "POST",
        headers,
        body: {
          name: "",
          email: `signup-limit-${RUN_ID}-limited@testflow.local`,
          password: "short",
        },
        expectedStatus: 429,
      });

      assert(limited.json?.error?.code === "RATE_LIMITED", "Expected RATE_LIMITED");
    });

    await check("admin login succeeds", async () => {
      adminJar = await login(accounts.admin, "Admin");
    });

    await check("cross-origin logout is rejected by CSRF guard", async () => {
      const result = await request("/api/auth/logout", {
        method: "POST",
        jar: adminJar,
        headers: { Origin: "https://evil.example" },
        expectedStatus: 403,
      });

      assert(result.json?.error?.code === "CSRF_FORBIDDEN", "Expected CSRF_FORBIDDEN");
      await request("/api/auth/me", {
        jar: adminJar,
        expectedStatus: 200,
      });
    });

    const memberJar = await login(accounts.member, "Member");
    console.log("PASS member login succeeds");
    const viewerJar = await login(accounts.viewer, "Viewer");
    console.log("PASS viewer login succeeds");

    await expectStatus("admin /api/auth/me returns 200", "/api/auth/me", 200, {
      jar: adminJar,
    });

    await check("admin /api/auth/me includes rolesByScope (COMPANY CO, WORKSPACE WO)", async () => {
      const result = await request("/api/auth/me", {
        jar: adminJar,
        expectedStatus: 200,
      });
      const data = result.json?.data;

      // 기존 필드는 그대로 유지(additive change 검증)
      assert(data?.role === "Admin", "legacy role field changed");
      assert(data?.permissions, "legacy permissions field missing");

      const rolesByScope = data?.rolesByScope;
      assert(rolesByScope, "rolesByScope missing in /api/auth/me");
      assert(
        Array.isArray(rolesByScope.company) &&
          rolesByScope.company.some((entry) => entry.role === "CO"),
        "expected COMPANY CO role for qa.lead",
      );
      assert(
        Array.isArray(rolesByScope.workspace) &&
          rolesByScope.workspace.some((entry) => entry.role === "WO"),
        "expected WORKSPACE WO role for qa.lead",
      );
    });

    await check("UserRole-first /api/auth/me keeps legacy role contract (member/viewer)", async () => {
      // c5-2: 런타임 권한 산출 근거가 UserRole(WORKSPACE) 우선으로 바뀌어도
      // legacy role 값(Admin/Member/Viewer)은 그대로 유지되어야 한다.
      // backend: WorkspaceMember.role=MEMBER & UserRole WORKSPACE=MEMBER -> "Member"
      const memberMe = await request("/api/auth/me", {
        jar: memberJar,
        expectedStatus: 200,
      });
      assert(memberMe.json?.data?.role === "Member", "member role should be Member");
      assert(
        memberMe.json?.data?.rolesByScope?.workspace?.some((entry) => entry.role === "MEMBER"),
        "member should have WORKSPACE MEMBER in rolesByScope",
      );

      // pm: WorkspaceMember.role=VIEWER & UserRole WORKSPACE=VIEWER -> "Viewer"
      const viewerMe = await request("/api/auth/me", {
        jar: viewerJar,
        expectedStatus: 200,
      });
      assert(viewerMe.json?.data?.role === "Viewer", "viewer role should be Viewer");
      assert(
        viewerMe.json?.data?.rolesByScope?.workspace?.some((entry) => entry.role === "VIEWER"),
        "viewer should have WORKSPACE VIEWER in rolesByScope",
      );
    });

    await check("cross-origin project write is rejected by CSRF guard", async () => {
      const result = await request("/api/projects", {
        method: "POST",
        jar: adminJar,
        headers: { Origin: "https://evil.example" },
        body: { name: `Blocked CSRF Project ${RUN_ID}` },
        expectedStatus: 403,
      });

      assert(result.json?.error?.code === "CSRF_FORBIDDEN", "Expected CSRF_FORBIDDEN");
    });

    await check("admin can create AI draft within rate limit", async () => {
      const result = await request("/api/projects/demo-project/test-cases/ai-drafts", {
        method: "POST",
        jar: adminJar,
        body: {
          featureName: "Auth smoke AI draft",
          requirementText: "사용자는 결제 내역을 검색하고 상세 내역을 확인할 수 있다.",
          scenarioCount: 1,
          testType: "normal",
        },
        expectedStatus: 201,
      });

      assert(result.json?.data?.draft?.id, "AI draft create did not return draft id");
    });

    await check("AI draft user rate limit returns 429", async () => {
      for (let index = 0; index < 19; index += 1) {
        await request("/api/projects/demo-project/test-cases/ai-drafts", {
          method: "POST",
          jar: adminJar,
          body: { featureName: `Rate limit ${index}` },
          expectedStatus: 400,
        });
      }

      const limited = await request("/api/projects/demo-project/test-cases/ai-drafts", {
        method: "POST",
        jar: adminJar,
        body: { featureName: "Rate limited" },
        expectedStatus: 429,
      });

      assert(limited.json?.error?.code === "RATE_LIMITED", "Expected RATE_LIMITED");
    });

    await check("admin can preview and commit CSV import within rate limit", async () => {
      const preview = await request("/api/projects/demo-project/test-cases/import/preview", {
        method: "POST",
        jar: adminJar,
        headers: { "Content-Type": "text/csv" },
        body:
          "folder,title,description,priority,status,tags,step1_action,step1_expected\n" +
          `payment-checkout,Auth smoke imported TC ${RUN_ID},CSV import smoke,medium,ready,auth-smoke,Run checkout,Checkout succeeds\n`,
        expectedStatus: 200,
      });

      assert(preview.json?.data?.validRows === 1, "CSV preview did not produce one valid row");

      const commit = await request("/api/projects/demo-project/test-cases/import/commit", {
        method: "POST",
        jar: adminJar,
        body: { rows: preview.json.data.rows },
        expectedStatus: 200,
      });
      const importedTestCaseIds = commit.json?.data?.testCases
        ?.map((item) => item.id)
        .filter(Boolean);

      assert(importedTestCaseIds?.length === 1, "CSV commit did not create one test case");
      cleanup.testCases.push(...importedTestCaseIds);
    });

    await check("CSV import user rate limit returns 429", async () => {
      for (let index = 0; index < 28; index += 1) {
        await request("/api/projects/demo-project/test-cases/import/preview", {
          method: "POST",
          jar: adminJar,
          headers: { "Content-Type": "text/csv" },
          body: "",
          expectedStatus: 400,
        });
      }

      const limited = await request("/api/projects/demo-project/test-cases/import/preview", {
        method: "POST",
        jar: adminJar,
        headers: { "Content-Type": "text/csv" },
        body: "",
        expectedStatus: 429,
      });

      assert(limited.json?.error?.code === "RATE_LIMITED", "Expected RATE_LIMITED");
    });

    const adminProject = await request("/api/projects", {
      method: "POST",
      jar: adminJar,
      body: {
        name: `Auth Smoke Project ${RUN_ID}`,
        slug: `auth-smoke-project-${RUN_ID}`,
        description: "Created by auth smoke test.",
        color: "#2563EB",
      },
      expectedStatus: 201,
    });
    const adminProjectId = adminProject.json?.data?.id;
    assert(adminProjectId, "Admin project create did not return data.id");
    cleanup.projects.push(adminProjectId);
    console.log("PASS admin can create project");

    await expectStatus(
      "admin can update project",
      `/api/projects/${adminProjectId}`,
      200,
      {
        method: "PATCH",
        jar: adminJar,
        body: { description: "Updated by auth smoke test." },
      },
    );

    const testCase = await request("/api/projects/demo-project/test-cases", {
      method: "POST",
      jar: adminJar,
      body: {
        title: `Auth smoke test case ${RUN_ID}`,
        folderId: "payment-checkout",
        priority: "medium",
        status: "ready",
        tags: ["auth-smoke"],
        steps: ["Open checkout", "Submit payment"],
        expectedResult: "Payment is submitted.",
      },
      expectedStatus: 201,
    });
    const testCaseId = testCase.json?.data?.id;
    assert(testCaseId, "Test case create did not return data.id");
    cleanup.testCases.push(testCaseId);
    console.log("PASS admin can create test case");

    await expectStatus(
      "admin can update test case",
      `/api/projects/demo-project/test-cases/${testCaseId}`,
      200,
      {
        method: "PATCH",
        jar: adminJar,
        body: { title: `Auth smoke test case updated ${RUN_ID}` },
      },
    );

    const runSlug = `auth-smoke-run-${RUN_ID}`;
    const run = await request("/api/projects/demo-project/runs", {
      method: "POST",
      jar: adminJar,
      body: {
        title: `Auth smoke run ${RUN_ID}`,
        slug: runSlug,
        description: "Created by auth smoke test.",
        assignee: "QA Lead",
        environment: "Smoke",
        testCaseIds: [testCaseId],
        startNow: true,
      },
      expectedStatus: 201,
    });
    const runId = run.json?.data?.id;
    const resultId = run.json?.data?.results?.[0]?.id;
    assert(runId && resultId, "Test run create did not return run/result ids");
    cleanup.runs.push(runId);
    console.log("PASS admin can create test run");

    await expectStatus(
      "admin can mark result failed",
      `/api/projects/demo-project/runs/${runId}/results/${resultId}`,
      200,
      {
        method: "PATCH",
        jar: adminJar,
        body: {
          status: "failed",
          actualResult: "Auth smoke failure result.",
        },
      },
    );

    const resultDefect = await request(
      `/api/projects/demo-project/runs/${runId}/results/${resultId}/defects`,
      {
        method: "POST",
        jar: adminJar,
        body: {
          title: `Auth smoke result defect ${RUN_ID}`,
          severity: "major",
          priority: "high",
        },
        expectedStatus: 201,
      },
    );
    const resultDefectId = resultDefect.json?.data?.defect?.id;
    assert(resultDefectId, "Result defect create did not return defect id");
    cleanup.defects.push(resultDefectId);
    console.log("PASS admin can create defect from failed result");

    const defect = await request("/api/projects/demo-project/defects", {
      method: "POST",
      jar: adminJar,
      body: {
        title: `Auth smoke defect ${RUN_ID}`,
        severity: "minor",
        priority: "medium",
        status: "open",
        testCaseIds: [testCaseId],
      },
      expectedStatus: 201,
    });
    const defectId = defect.json?.data?.id;
    assert(defectId, "Defect create did not return data.id");
    cleanup.defects.push(defectId);
    console.log("PASS admin can create defect");

    const memberProject = await request("/api/projects", {
      method: "POST",
      jar: memberJar,
      body: {
        name: `Member Smoke Project ${RUN_ID}`,
        slug: `member-smoke-project-${RUN_ID}`,
      },
      expectedStatus: 201,
    });
    const memberProjectId = memberProject.json?.data?.id;
    assert(memberProjectId, "Member project create did not return data.id");
    cleanup.projects.push(memberProjectId);
    console.log("PASS member can create project");

    await expectStatus(
      "member can update project",
      `/api/projects/${memberProjectId}`,
      200,
      {
        method: "PATCH",
        jar: memberJar,
        body: { description: "Member update is allowed." },
      },
    );
    await expectStatus(
      "member cannot delete project",
      `/api/projects/${memberProjectId}`,
      403,
      {
        method: "DELETE",
        jar: memberJar,
      },
    );
    await expectStatus(
      "member cannot delete test case",
      "/api/projects/demo-project/test-cases/TC-001",
      403,
      {
        method: "DELETE",
        jar: memberJar,
      },
    );
    await expectStatus(
      "member cannot delete defect",
      "/api/projects/demo-project/defects/BUG-001",
      403,
      {
        method: "DELETE",
        jar: memberJar,
      },
    );

    for (const path of [
      "/api/projects",
      "/api/dashboard/summary",
      "/api/projects/demo-project/reports/summary",
      "/api/projects/demo-project/test-cases",
      "/api/projects/demo-project/runs",
      "/api/projects/demo-project/defects",
    ]) {
      await expectStatus(`viewer can read ${path}`, path, 200, {
        jar: viewerJar,
      });
    }

    await expectStatus("viewer cannot create project", "/api/projects", 403, {
      method: "POST",
      jar: viewerJar,
      body: { name: `Viewer Project ${RUN_ID}` },
    });
    await expectStatus(
      "viewer cannot create test case",
      "/api/projects/demo-project/test-cases",
      403,
      {
        method: "POST",
        jar: viewerJar,
        body: { title: `Viewer TC ${RUN_ID}` },
      },
    );
    await expectStatus(
      "viewer cannot update run result",
      `/api/projects/demo-project/runs/${runId}/results/${resultId}`,
      403,
      {
        method: "PATCH",
        jar: viewerJar,
        body: { status: "passed" },
      },
    );
    await expectStatus(
      "viewer cannot create defect",
      "/api/projects/demo-project/defects",
      403,
      {
        method: "POST",
        jar: viewerJar,
        body: { title: `Viewer defect ${RUN_ID}` },
      },
    );
    await expectStatus(
      "viewer cannot create AI draft",
      "/api/projects/demo-project/test-cases/ai-drafts",
      403,
      {
        method: "POST",
        jar: viewerJar,
        body: { featureName: "Viewer", requirementText: "Read only" },
      },
    );
    await expectStatus(
      "viewer cannot preview CSV import",
      "/api/projects/demo-project/test-cases/import/preview",
      403,
      {
        method: "POST",
        jar: viewerJar,
        headers: { "Content-Type": "text/csv" },
        body: "title,priority\nViewer,row\n",
      },
    );

    // c5-3: UserRole-first 입증 — WorkspaceMember.role 을 VIEWER 로 강등해도
    // UserRole WORKSPACE/WO 때문에 /api/auth/me 와 guard 권한은 Admin 으로 유지된다.
    await check(
      "UserRole-first: WorkspaceMember.role=VIEWER but UserRole WO keeps Admin (me + guard)",
      async () => {
        const prisma = getPrisma();
        const adminUser = await prisma.user.findUnique({
          where: { email: accounts.admin },
          select: { id: true },
        });
        assert(adminUser, "admin user not found in DB");

        const membership = await prisma.workspaceMember.findFirst({
          where: { userId: adminUser.id },
          select: { id: true, role: true, workspaceId: true },
        });
        assert(membership, "admin workspace membership not found");

        const woRole = await prisma.userRole.findUnique({
          where: {
            userId_scopeType_scopeId: {
              userId: adminUser.id,
              scopeType: "WORKSPACE",
              scopeId: membership.workspaceId,
            },
          },
          select: { role: true },
        });
        assert(woRole?.role === "WO", "expected qa.lead WORKSPACE/WO UserRole");

        const originalMemberRole = membership.role; // ADMIN

        try {
          // WorkspaceMember.role 만 VIEWER 로 임시 강등 (UserRole 은 WO 유지)
          await prisma.workspaceMember.update({
            where: { id: membership.id },
            data: { role: "VIEWER" },
          });

          const jar = await loginRaw(accounts.admin);

          // (1) /api/auth/me 는 UserRole-first 라 Admin 유지
          const me = await request("/api/auth/me", { jar, expectedStatus: 200 });
          assert(
            me.json?.data?.role === "Admin",
            `expected Admin from UserRole WO, got ${me.json?.data?.role}`,
          );
          assert(
            (me.json?.data?.rolesByScope?.workspace ?? []).some((entry) => entry.role === "WO"),
            "expected WORKSPACE WO in rolesByScope despite WorkspaceMember.role=VIEWER",
          );

          // (2) guard 권한도 UserRole-first → Admin 전용 동작(삭제) 성공
          const proj = await request("/api/projects", {
            method: "POST",
            jar,
            body: {
              name: `UserRole-first Proof ${RUN_ID}`,
              slug: `userrole-first-proof-${RUN_ID}`,
            },
            expectedStatus: 201,
          });
          const projId = proj.json?.data?.id;
          assert(projId, "downgraded admin failed to create project");

          await request(`/api/projects/${projId}`, {
            method: "DELETE",
            jar,
            expectedStatus: 200,
          });
        } finally {
          // 복원: 이후 cleanup/로그아웃 흐름 및 다음 실행 보호
          await prisma.workspaceMember.update({
            where: { id: membership.id },
            data: { role: originalMemberRole },
          });
        }
      },
    );

    // c5-3: fallback 입증 — UserRole(WORKSPACE) 이 없으면 WorkspaceMember.role 로 fallback 한다.
    await check(
      "fallback: no UserRole -> WorkspaceMember.role drives /api/auth/me role",
      async () => {
        const prisma = getPrisma();
        const viewerUser = await prisma.user.findUnique({
          where: { email: accounts.viewer },
          select: { id: true },
        });
        assert(viewerUser, "viewer user not found in DB");

        const membership = await prisma.workspaceMember.findFirst({
          where: { userId: viewerUser.id },
          select: { id: true, role: true, workspaceId: true },
        });
        assert(membership, "viewer workspace membership not found");

        const key = {
          userId: viewerUser.id,
          scopeType: "WORKSPACE",
          scopeId: membership.workspaceId,
        };
        const original = await prisma.userRole.findUnique({
          where: { userId_scopeType_scopeId: key },
          select: { role: true },
        });
        const originalMemberRole = membership.role; // VIEWER

        try {
          // UserRole 제거 → fallback 경로 강제 + WorkspaceMember.role 을 MEMBER 로 변경
          if (original) {
            await prisma.userRole.delete({ where: { userId_scopeType_scopeId: key } });
          }
          await prisma.workspaceMember.update({
            where: { id: membership.id },
            data: { role: "MEMBER" },
          });

          const jar = await loginRaw(accounts.viewer);
          const me = await request("/api/auth/me", { jar, expectedStatus: 200 });
          assert(
            me.json?.data?.role === "Member",
            `expected fallback Member from WorkspaceMember.role, got ${me.json?.data?.role}`,
          );
          assert(
            (me.json?.data?.rolesByScope?.workspace ?? []).length === 0,
            "expected empty workspace rolesByScope when UserRole absent",
          );
        } finally {
          // 복원: WorkspaceMember.role + UserRole(WORKSPACE) 원복
          await prisma.workspaceMember.update({
            where: { id: membership.id },
            data: { role: originalMemberRole },
          });
          if (original) {
            await prisma.userRole.upsert({
              where: { userId_scopeType_scopeId: key },
              update: { role: original.role },
              create: { ...key, role: original.role },
            });
          }
        }
      },
    );

    // c6-1: CO Role 매트릭스 sync API 검증.
    {
      const prisma = getPrisma();
      const leadUser = await prisma.user.findUnique({
        where: { email: accounts.admin },
        select: { id: true },
      });
      const co = await prisma.userRole.findFirst({
        where: { userId: leadUser.id, scopeType: "COMPANY", role: "CO" },
        select: { scopeId: true },
      });
      const companyId = co.scopeId;

      const backendUser = await prisma.user.findUnique({
        where: { email: accounts.member },
        select: { id: true },
      });
      const backendMembership = await prisma.workspaceMember.findFirst({
        where: { userId: backendUser.id },
        select: { workspaceId: true },
      });
      const workspaceId = backendMembership.workspaceId;
      const syncPath = `/api/company/users/${backendUser.id}/roles/sync`;

      // c7-1: CO 회원 목록 + Role 요약
      await check("CO can list company users with role summary", async () => {
        const result = await request("/api/company/users", {
          jar: adminJar,
          expectedStatus: 200,
        });
        const users = result.json?.data?.users ?? [];
        const byEmail = new Map(users.map((u) => [u.email, u]));

        assert(
          byEmail.has(accounts.admin) &&
            byEmail.has(accounts.member) &&
            byEmail.has("frontend@testflow.local") &&
            byEmail.has(accounts.viewer),
          "expected all 4 seeded users in company list",
        );

        const lead = byEmail.get(accounts.admin);
        assert(
          lead.roles.includes("CO") && lead.roles.includes("WO(W)"),
          `qa.lead summary should include CO and WO(W); got ${JSON.stringify(lead.roles)}`,
        );
        assert(
          byEmail.get(accounts.member).roles.includes("M(W)"),
          "backend summary should include M(W)",
        );
        assert(
          byEmail.get("frontend@testflow.local").roles.includes("M(W)"),
          "frontend summary should include M(W)",
        );
        assert(
          byEmail.get(accounts.viewer).roles.includes("V(W)"),
          "pm summary should include V(W)",
        );
      });

      await check("non-CO cannot list company users (403)", async () => {
        const result = await request("/api/company/users", {
          jar: memberJar,
          expectedStatus: 403,
        });
        assert(result.json?.error?.code === "AUTH_FORBIDDEN", "expected AUTH_FORBIDDEN");
      });

      // c7-2: CO 사용자 상세 조회 (Role Matrix 편집 데이터)
      const pmUser = await prisma.user.findUnique({
        where: { email: accounts.viewer },
        select: { id: true },
      });

      await check("CO can fetch user detail with UserRole + workspace/project tree", async () => {
        const result = await request(`/api/company/users/${leadUser.id}`, {
          jar: adminJar,
          expectedStatus: 200,
        });
        const detail = result.json?.data;
        assert(detail?.userId === leadUser.id, "detail.userId mismatch");
        assert(detail?.company?.id === companyId, "detail.company.id should match CO company");
        assert(Array.isArray(detail?.workspaces) && detail.workspaces.length > 0, "expected workspaces");
        assert(
          detail.workspaces.some((w) => Array.isArray(w.projects) && w.projects.length > 0),
          "expected at least one workspace with projects",
        );
        const roles = detail?.roles ?? [];
        // qa.lead = CO (COMPANY) + WO (WORKSPACE) → 화면 토큰 CO, WO(W)
        assert(
          roles.some((r) => r.scopeType === "COMPANY" && r.scopeId === companyId && r.role === "CO"),
          `qa.lead detail should include COMPANY/CO; got ${JSON.stringify(roles)}`,
        );
        assert(
          roles.some((r) => r.scopeType === "WORKSPACE" && r.role === "WO"),
          "qa.lead detail should include WORKSPACE/WO (WO(W))",
        );
      });

      await check("CO user detail reflects UserRole for member/viewer (M(W)/V(W))", async () => {
        const backend = await request(`/api/company/users/${backendUser.id}`, {
          jar: adminJar,
          expectedStatus: 200,
        });
        assert(
          (backend.json?.data?.roles ?? []).some(
            (r) => r.scopeType === "WORKSPACE" && r.role === "MEMBER",
          ),
          "backend detail should include WORKSPACE/MEMBER (M(W))",
        );

        const pm = await request(`/api/company/users/${pmUser.id}`, {
          jar: adminJar,
          expectedStatus: 200,
        });
        assert(
          (pm.json?.data?.roles ?? []).some(
            (r) => r.scopeType === "WORKSPACE" && r.role === "VIEWER",
          ),
          "pm detail should include WORKSPACE/VIEWER (V(W))",
        );
      });

      await check("non-CO cannot fetch user detail (403)", async () => {
        const result = await request(`/api/company/users/${leadUser.id}`, {
          jar: memberJar,
          expectedStatus: 403,
        });
        assert(result.json?.error?.code === "AUTH_FORBIDDEN", "expected AUTH_FORBIDDEN");
      });

      await check("CO user detail returns 404 for unknown user", async () => {
        const result = await request("/api/company/users/cmthisuserdoesnotexist0001", {
          jar: adminJar,
          expectedStatus: 404,
        });
        assert(result.json?.error?.code === "USER_NOT_FOUND", "expected USER_NOT_FOUND");
      });

      // c8-3: Company scope tree API
      await check("CO can fetch company scope tree (workspaces + projects only)", async () => {
        const result = await request("/api/company/scopes", {
          jar: adminJar,
          expectedStatus: 200,
        });
        const data = result.json?.data;
        assert(data?.company?.id === companyId, "scope tree company.id should match CO company");
        assert(Array.isArray(data?.workspaces) && data.workspaces.length > 0, "expected workspaces");
        assert(
          data.workspaces.some((w) => w.id === workspaceId),
          "company workspace should be present in scope tree",
        );
        assert(
          data.workspaces.some((w) => Array.isArray(w.projects) && w.projects.length > 0),
          "expected at least one workspace with projects",
        );

        const companyWorkspaceIds = new Set(
          (
            await prisma.workspace.findMany({ where: { companyId }, select: { id: true } })
          ).map((w) => w.id),
        );
        assert(
          data.workspaces.every((w) => companyWorkspaceIds.has(w.id)),
          "scope tree must only contain this company's workspaces",
        );
      });

      await check("non-CO cannot fetch company scope tree (403)", async () => {
        const result = await request("/api/company/scopes", {
          jar: memberJar,
          expectedStatus: 403,
        });
        assert(result.json?.error?.code === "AUTH_FORBIDDEN", "expected AUTH_FORBIDDEN");
      });

      // c8-1: Company 초대 생성/목록/취소
      {
        const inviteEmail = `invite.c81.${RUN_ID}@testflow.local`.toLowerCase();
        try {
          let firstInviteId = null;

          await check("CO can create WORKSPACE/MEMBER invitation with inviteUrl", async () => {
            const result = await request("/api/company/invitations", {
              method: "POST",
              jar: adminJar,
              body: {
                email: inviteEmail,
                roles: [{ scopeType: "WORKSPACE", scopeId: workspaceId, role: "MEMBER" }],
              },
              expectedStatus: 201,
            });
            const data = result.json?.data;
            assert(
              typeof data?.inviteUrl === "string" &&
                data.inviteUrl.startsWith("/invite/accept?token="),
              `inviteUrl missing/format; got ${JSON.stringify(data?.inviteUrl)}`,
            );
            assert(data?.invitation?.status === "PENDING", "new invitation should be PENDING");
            assert(
              (data.invitation.roles ?? []).some(
                (r) => r.scopeType === "WORKSPACE" && r.scopeId === workspaceId && r.role === "MEMBER",
              ),
              "invitation role snapshot missing WORKSPACE/MEMBER",
            );
            assert(
              !("tokenHash" in (data.invitation ?? {})),
              "tokenHash must not be serialized in response",
            );
            firstInviteId = data.invitation.id;

            // DB: tokenHash 만 저장되고 raw token 은 저장되지 않아야 한다.
            const token = new URL(`http://x${data.inviteUrl}`).searchParams.get("token");
            assert(typeof token === "string" && token.length >= 32, "raw token should be in url");
            const row = await prisma.invitation.findUnique({ where: { id: firstInviteId } });
            const expectedHash = createHash("sha256").update(token).digest("hex");
            assert(row.tokenHash === expectedHash, "DB tokenHash must equal sha256(rawToken)");
            assert(row.tokenHash !== token, "DB must not store raw token");
          });

          await check("Invitation list returns the invitation + role snapshot (no tokenHash)", async () => {
            const result = await request("/api/company/invitations", {
              jar: adminJar,
              expectedStatus: 200,
            });
            const invitations = result.json?.data?.invitations ?? [];
            const mine = invitations.find((i) => i.email === inviteEmail);
            assert(mine, "created invitation should appear in list");
            assert(mine.status === "PENDING", "listed invitation should be PENDING");
            assert(!("tokenHash" in mine), "list must not expose tokenHash");
            assert(
              (mine.roles ?? []).some(
                (r) => r.scopeType === "WORKSPACE" && r.scopeId === workspaceId && r.role === "MEMBER",
              ),
              "listed invitation missing role snapshot",
            );
            assert(mine.invitedBy, "invitedBy should be present");
          });

          await check("non-CO cannot create or list invitations (403)", async () => {
            const create = await request("/api/company/invitations", {
              method: "POST",
              jar: memberJar,
              body: {
                email: `nope.${RUN_ID}@testflow.local`,
                roles: [{ scopeType: "WORKSPACE", scopeId: workspaceId, role: "MEMBER" }],
              },
              expectedStatus: 403,
            });
            assert(create.json?.error?.code === "AUTH_FORBIDDEN", "create expected AUTH_FORBIDDEN");

            const list = await request("/api/company/invitations", {
              jar: memberJar,
              expectedStatus: 403,
            });
            assert(list.json?.error?.code === "AUTH_FORBIDDEN", "list expected AUTH_FORBIDDEN");
          });

          await check("invitation scope-role violation → USER_INVALID_ROLE_SCOPE", async () => {
            const result = await request("/api/company/invitations", {
              method: "POST",
              jar: adminJar,
              body: {
                email: `bad-role.${RUN_ID}@testflow.local`,
                roles: [{ scopeType: "WORKSPACE", scopeId: workspaceId, role: "PO" }],
              },
              expectedStatus: 400,
            });
            assert(
              result.json?.error?.code === "USER_INVALID_ROLE_SCOPE",
              "expected USER_INVALID_ROLE_SCOPE",
            );
          });

          await check("invitation out-of-company scope → USER_SCOPE_NOT_IN_COMPANY", async () => {
            const result = await request("/api/company/invitations", {
              method: "POST",
              jar: adminJar,
              body: {
                email: `bad-scope.${RUN_ID}@testflow.local`,
                roles: [
                  { scopeType: "WORKSPACE", scopeId: "ws-not-in-this-company", role: "MEMBER" },
                ],
              },
              expectedStatus: 400,
            });
            assert(
              result.json?.error?.code === "USER_SCOPE_NOT_IN_COMPANY",
              "expected USER_SCOPE_NOT_IN_COMPANY",
            );
          });

          await check("re-inviting same email revokes prior PENDING and creates new PENDING", async () => {
            const result = await request("/api/company/invitations", {
              method: "POST",
              jar: adminJar,
              body: {
                email: inviteEmail,
                roles: [{ scopeType: "WORKSPACE", scopeId: workspaceId, role: "VIEWER" }],
              },
              expectedStatus: 201,
            });
            const secondInviteId = result.json?.data?.invitation?.id;
            assert(secondInviteId && secondInviteId !== firstInviteId, "new invitation should be created");

            const prior = await prisma.invitation.findUnique({ where: { id: firstInviteId } });
            assert(prior?.status === "REVOKED", "prior PENDING invitation should be REVOKED");
            assert(prior?.revokedAt, "revokedAt should be set on auto-revoke");

            const current = await prisma.invitation.findUnique({ where: { id: secondInviteId } });
            assert(current?.status === "PENDING", "new invitation should be PENDING");

            // CO 가 새 초대를 revoke 할 수 있어야 한다.
            const revoke = await request(`/api/company/invitations/${secondInviteId}/revoke`, {
              method: "POST",
              jar: adminJar,
              expectedStatus: 200,
            });
            assert(revoke.json?.data?.invitation?.status === "REVOKED", "revoke should set REVOKED");

            const revoked = await prisma.invitation.findUnique({ where: { id: secondInviteId } });
            assert(revoked?.status === "REVOKED", "DB should reflect REVOKED");
          });
        } finally {
          // 정리: 이 테스트가 만든 초대(및 cascade 로 InvitationRole) 삭제.
          await prisma.invitation.deleteMany({ where: { email: inviteEmail } });
        }
      }

      // c8-4: PENDING 초대 재발송
      {
        const baseEmail = `resend.c84.${RUN_ID}@testflow.local`.toLowerCase();
        const npEmail = `resend.np.${RUN_ID}@testflow.local`.toLowerCase();
        const revokedEmail = `resend.revoked.${RUN_ID}@testflow.local`.toLowerCase();
        const acceptedEmail = `resend.accepted.${RUN_ID}@testflow.local`.toLowerCase();
        const expiredEmail = `resend.expired.${RUN_ID}@testflow.local`.toLowerCase();
        const cleanupEmails = [baseEmail, npEmail, revokedEmail, acceptedEmail, expiredEmail];

        async function createInvite(email, roles) {
          const r = await request("/api/company/invitations", {
            method: "POST",
            jar: adminJar,
            body: { email, roles },
            expectedStatus: 201,
          });
          const token = new URL(`http://x${r.json.data.inviteUrl}`).searchParams.get("token");
          return { id: r.json.data.invitation.id, token };
        }

        try {
          await check("CO can resend a PENDING invitation (old REVOKED, new PENDING, same snapshot, new token)", async () => {
            const old = await createInvite(baseEmail, [
              { scopeType: "WORKSPACE", scopeId: workspaceId, role: "MEMBER" },
            ]);
            const oldRow = await prisma.invitation.findUnique({ where: { id: old.id } });

            const result = await request(`/api/company/invitations/${old.id}/resend`, {
              method: "POST",
              jar: adminJar,
              expectedStatus: 201,
            });
            const data = result.json?.data;
            assert(
              typeof data?.inviteUrl === "string" &&
                data.inviteUrl.startsWith("/invite/accept?token="),
              "resend inviteUrl missing/format",
            );
            assert(data?.invitation?.id && data.invitation.id !== old.id, "new invitation id should differ");
            assert(data.invitation.status === "PENDING", "new invitation should be PENDING");
            assert(data.invitation.email === baseEmail, "email should be identical");
            assert(
              (data.invitation.roles ?? []).some(
                (r) => r.scopeType === "WORKSPACE" && r.scopeId === workspaceId && r.role === "MEMBER",
              ),
              "role snapshot should be copied",
            );
            assert(!("tokenHash" in data.invitation), "tokenHash must not be serialized");

            const newToken = new URL(`http://x${data.inviteUrl}`).searchParams.get("token");
            const newId = data.invitation.id;

            const oldAfter = await prisma.invitation.findUnique({ where: { id: old.id } });
            assert(oldAfter.status === "REVOKED" && oldAfter.revokedAt, "old invitation should be REVOKED");

            const newRow = await prisma.invitation.findUnique({ where: { id: newId } });
            assert(newRow.status === "PENDING", "new invitation should be PENDING in DB");
            assert(newRow.tokenHash !== oldRow.tokenHash, "new tokenHash must differ from old");
            assert(
              newRow.tokenHash === createHash("sha256").update(newToken).digest("hex"),
              "new tokenHash must equal sha256(newToken)",
            );
            const byRaw = await prisma.invitation.findFirst({ where: { tokenHash: newToken } });
            assert(!byRaw, "raw token must not be stored");

            const oldValidate = await request("/api/invitations/validate", {
              method: "POST",
              body: { token: old.token },
              expectedStatus: 400,
            });
            assert(oldValidate.json?.error?.code === "INVITE_REVOKED", "old token should be INVITE_REVOKED");

            const newValidate = await request("/api/invitations/validate", {
              method: "POST",
              body: { token: newToken },
              expectedStatus: 200,
            });
            assert(
              newValidate.json?.data?.email === baseEmail && newValidate.json?.data?.existingUser === false,
              "new token should validate as PENDING",
            );
          });

          await check("non-CO cannot resend invitation (403)", async () => {
            const inv = await createInvite(npEmail, [
              { scopeType: "WORKSPACE", scopeId: workspaceId, role: "MEMBER" },
            ]);
            const result = await request(`/api/company/invitations/${inv.id}/resend`, {
              method: "POST",
              jar: memberJar,
              expectedStatus: 403,
            });
            assert(result.json?.error?.code === "AUTH_FORBIDDEN", "expected AUTH_FORBIDDEN");
          });

          await check("resend rejects non-PENDING invitations → INVITE_NOT_PENDING", async () => {
            const revoked = await createInvite(revokedEmail, [
              { scopeType: "WORKSPACE", scopeId: workspaceId, role: "MEMBER" },
            ]);
            await request(`/api/company/invitations/${revoked.id}/revoke`, {
              method: "POST",
              jar: adminJar,
              expectedStatus: 200,
            });
            const r1 = await request(`/api/company/invitations/${revoked.id}/resend`, {
              method: "POST",
              jar: adminJar,
              expectedStatus: 400,
            });
            assert(r1.json?.error?.code === "INVITE_NOT_PENDING", "REVOKED resend → INVITE_NOT_PENDING");

            const accepted = await createInvite(acceptedEmail, [
              { scopeType: "WORKSPACE", scopeId: workspaceId, role: "MEMBER" },
            ]);
            await prisma.invitation.update({
              where: { id: accepted.id },
              data: { status: "ACCEPTED", acceptedAt: new Date() },
            });
            const r2 = await request(`/api/company/invitations/${accepted.id}/resend`, {
              method: "POST",
              jar: adminJar,
              expectedStatus: 400,
            });
            assert(r2.json?.error?.code === "INVITE_NOT_PENDING", "ACCEPTED resend → INVITE_NOT_PENDING");

            const expired = await createInvite(expiredEmail, [
              { scopeType: "WORKSPACE", scopeId: workspaceId, role: "MEMBER" },
            ]);
            await prisma.invitation.update({
              where: { id: expired.id },
              data: { expiresAt: new Date(Date.now() - 1000) },
            });
            const r3 = await request(`/api/company/invitations/${expired.id}/resend`, {
              method: "POST",
              jar: adminJar,
              expectedStatus: 400,
            });
            assert(r3.json?.error?.code === "INVITE_NOT_PENDING", "EXPIRED resend → INVITE_NOT_PENDING");
          });

          await check("resend unknown invitation → 404 INVITE_NOT_FOUND", async () => {
            const result = await request("/api/company/invitations/cmthisinvitedoesnotexist01/resend", {
              method: "POST",
              jar: adminJar,
              expectedStatus: 404,
            });
            assert(result.json?.error?.code === "INVITE_NOT_FOUND", "expected INVITE_NOT_FOUND");
          });
        } finally {
          await prisma.invitation.deleteMany({ where: { email: { in: cleanupEmails } } });
        }
      }

      // c8-5: 초대 목록 검색·상태 필터·정렬·서버 페이지네이션
      {
        const tag = `c85-${RUN_ID}`;
        const base = Date.now();
        let tokSeq = 0;
        let otherCompanyId = null;

        async function mkInv(cid, email, status, createdAt, expiresAt) {
          tokSeq += 1;
          return prisma.invitation.create({
            data: {
              companyId: cid,
              email,
              status,
              tokenHash: createHash("sha256").update(`${email}-${tokSeq}-${RUN_ID}`).digest("hex"),
              invitedByUserId: leadUser.id,
              createdAt: new Date(createdAt),
              expiresAt: new Date(expiresAt),
              ...(status === "REVOKED" ? { revokedAt: new Date() } : {}),
              ...(status === "ACCEPTED" ? { acceptedAt: new Date() } : {}),
              roles: { create: [{ scopeType: "WORKSPACE", scopeId: workspaceId, role: "MEMBER" }] },
            },
          });
        }

        async function listInv(jar, query, expectedStatus = 200) {
          return request(`/api/company/invitations${query ? `?${query}` : ""}`, { jar, expectedStatus });
        }

        try {
          // 12 PENDING(p1..p12): createdAt 증가, expiresAt 감소(미래 유지) → 정렬 검증용.
          for (let i = 1; i <= 12; i += 1) {
            await mkInv(
              companyId,
              `${tag}-p${String(i).padStart(2, "0")}@filter.local`,
              "PENDING",
              base + i * 1000,
              base + 3_600_000 - i * 1000,
            );
          }
          await mkInv(companyId, `${tag}-accepted@filter.local`, "ACCEPTED", base + 50_000, base + 3_600_000);
          await mkInv(companyId, `${tag}-revoked@filter.local`, "REVOKED", base + 60_000, base + 3_600_000);
          await mkInv(companyId, `${tag}-expired@filter.local`, "EXPIRED", base + 70_000, base - 1000);

          await check("invitation list: status filters return correct counts", async () => {
            const all = await listInv(adminJar, `q=${tag}`);
            assert(all.json?.data?.pagination?.total === 15, `ALL total should be 15, got ${all.json?.data?.pagination?.total}`);
            assert(Array.isArray(all.json.data.invitations), "invitations array preserved");

            const pending = await listInv(adminJar, `q=${tag}&status=PENDING`);
            assert(pending.json.data.pagination.total === 12, "PENDING total should be 12");
            const accepted = await listInv(adminJar, `q=${tag}&status=ACCEPTED`);
            assert(accepted.json.data.pagination.total === 1, "ACCEPTED total should be 1");
            const revoked = await listInv(adminJar, `q=${tag}&status=REVOKED`);
            assert(revoked.json.data.pagination.total === 1, "REVOKED total should be 1");
            const expired = await listInv(adminJar, `q=${tag}&status=EXPIRED`);
            assert(expired.json.data.pagination.total === 1, "EXPIRED total should be 1");
            assert(
              expired.json.data.invitations[0]?.email === `${tag}-expired@filter.local`,
              "EXPIRED filter should return the expired invitation",
            );
          });

          await check("invitation list: q email search is case-insensitive contains", async () => {
            const result = await listInv(adminJar, `q=${tag}-P03@FILTER`);
            assert(result.json.data.pagination.total === 1, "q should match exactly one");
            assert(
              result.json.data.invitations[0]?.email === `${tag}-p03@filter.local`,
              "q should return p03 case-insensitively",
            );
          });

          await check("invitation list: server pagination meta (size/page/clamp)", async () => {
            const p1 = await listInv(adminJar, `q=${tag}&status=PENDING&size=10&page=1`);
            const meta = p1.json.data.pagination;
            assert(meta.total === 12 && meta.size === 10 && meta.totalPages === 2, "page1 meta wrong");
            assert(meta.page === 1 && meta.hasPrevious === false && meta.hasNext === true, "page1 flags wrong");
            assert(p1.json.data.invitations.length === 10, "page1 should have 10 rows");

            const p2 = await listInv(adminJar, `q=${tag}&status=PENDING&size=10&page=2`);
            assert(p2.json.data.invitations.length === 2, "page2 should have 2 rows");
            assert(p2.json.data.pagination.hasNext === false && p2.json.data.pagination.hasPrevious === true, "page2 flags wrong");

            // 범위 초과 page → 마지막 유효 page 로 clamp.
            const over = await listInv(adminJar, `q=${tag}&status=PENDING&size=10&page=99`);
            assert(over.json.data.pagination.page === 2, "overflow page should clamp to 2");
            assert(over.json.data.invitations.length === 2, "clamped page should return last page rows");
          });

          await check("invitation list: sort newest/oldest/expiresAtAsc/expiresAtDesc", async () => {
            const oldest = await listInv(adminJar, `q=${tag}&status=PENDING&sort=oldest`);
            assert(oldest.json.data.invitations[0]?.email === `${tag}-p01@filter.local`, "oldest first should be p01");
            const newest = await listInv(adminJar, `q=${tag}&status=PENDING&sort=newest`);
            assert(newest.json.data.invitations[0]?.email === `${tag}-p12@filter.local`, "newest first should be p12");
            const expAsc = await listInv(adminJar, `q=${tag}&status=PENDING&sort=expiresAtAsc`);
            assert(expAsc.json.data.invitations[0]?.email === `${tag}-p12@filter.local`, "expiresAtAsc first should be p12");
            const expDesc = await listInv(adminJar, `q=${tag}&status=PENDING&sort=expiresAtDesc`);
            assert(expDesc.json.data.invitations[0]?.email === `${tag}-p01@filter.local`, "expiresAtDesc first should be p01");
          });

          await check("invitation list: invalid query params fall back to safe defaults", async () => {
            const result = await listInv(adminJar, `q=${tag}&status=BOGUS&size=999&sort=weird&page=abc`);
            const data = result.json.data;
            assert(data.pagination.size === 20, "invalid size → 20");
            assert(data.pagination.page === 1, "invalid page → 1");
            assert(data.filters.status === "ALL", "invalid status → ALL");
            assert(data.filters.sort === "newest", "invalid sort → newest");
            assert(data.pagination.total === 15, "ALL fallback total should be 15");
          });

          await check("invitation list: non-CO with query is 403", async () => {
            const result = await listInv(memberJar, `q=${tag}&status=PENDING&page=2`, 403);
            assert(result.json?.error?.code === "AUTH_FORBIDDEN", "expected AUTH_FORBIDDEN");
          });

          await check("invitation list: other-company invitations are never included", async () => {
            const other = await prisma.company.create({
              data: { name: `Other Co ${RUN_ID}`, slug: `other-co-${RUN_ID}` },
            });
            otherCompanyId = other.id;
            await mkInv(other.id, `${tag}-othercompany@filter.local`, "PENDING", base + 80_000, base + 3_600_000);

            const result = await listInv(adminJar, `q=${tag}`);
            assert(
              !result.json.data.invitations.some((i) => i.email === `${tag}-othercompany@filter.local`),
              "other company's invitation must not appear",
            );
            assert(result.json.data.pagination.total === 15, "other company invite must not affect total");
          });
        } finally {
          await prisma.invitation.deleteMany({ where: { email: { contains: tag } } });
          if (otherCompanyId) {
            await prisma.company.delete({ where: { id: otherCompanyId } }).catch(() => {});
          }
        }
      }

      // c8-2: 초대 수락(validate / 신규 가입 / 기존 사용자 / 충돌·만료·취소)
      {
        const project = await prisma.project.findFirst({
          where: { workspace: { companyId } },
          select: { id: true },
        });
        const projectId = project.id;

        const newEmail = `accept.new.${RUN_ID}@testflow.local`.toLowerCase();
        const mismatchEmail = `accept.mismatch.${RUN_ID}@testflow.local`.toLowerCase();
        const revokedEmail = `accept.revoked.${RUN_ID}@testflow.local`.toLowerCase();
        const expiredEmail = `accept.expired.${RUN_ID}@testflow.local`.toLowerCase();
        const rawEmail = `accept.rawcheck.${RUN_ID}@testflow.local`.toLowerCase();
        const testEmails = [
          newEmail,
          mismatchEmail,
          revokedEmail,
          expiredEmail,
          rawEmail,
          accounts.viewer,
          accounts.member,
        ];

        async function createInvite(email, roles) {
          const result = await request("/api/company/invitations", {
            method: "POST",
            jar: adminJar,
            body: { email, roles },
            expectedStatus: 201,
          });
          const inviteUrl = result.json.data.inviteUrl;
          const token = new URL(`http://x${inviteUrl}`).searchParams.get("token");
          return { id: result.json.data.invitation.id, token };
        }

        try {
          let newToken = null;

          await check("invite validate returns invitation info for new user", async () => {
            const created = await createInvite(newEmail, [
              { scopeType: "WORKSPACE", scopeId: workspaceId, role: "MEMBER" },
            ]);
            newToken = created.token;
            const result = await request("/api/invitations/validate", {
              method: "POST",
              body: { token: newToken },
              expectedStatus: 200,
            });
            const data = result.json?.data;
            assert(data?.email === newEmail, "validate email mismatch");
            assert(data?.existingUser === false, "should be a new user");
            assert(typeof data?.companyName === "string" && data.companyName, "companyName missing");
            assert(
              (data?.roles ?? []).some((r) => r.scopeType === "WORKSPACE" && r.role === "MEMBER"),
              "role snapshot missing",
            );
            assert(!("token" in data) && !("tokenHash" in data), "validate must not echo token");
          });

          await check("new user accept creates user + promotes role + opens session", async () => {
            const jar = new CookieJar();
            const result = await request("/api/invitations/accept", {
              method: "POST",
              jar,
              body: { token: newToken, name: "초대 신규", password: "password123!" },
              expectedStatus: 201,
            });
            assert(result.json?.data?.isNewUser === true, "should be new-user accept");
            assert(jar.cookies.has("tf_session"), "session cookie should be set for new user");

            const user = await prisma.user.findUnique({
              where: { email: newEmail },
              select: { id: true, passwordHash: true },
            });
            assert(user, "new user should be created");
            assert(
              typeof user.passwordHash === "string" && user.passwordHash.startsWith("$2"),
              "bcrypt passwordHash expected",
            );

            const inv = await prisma.invitation.findFirst({
              where: { email: newEmail },
              orderBy: { createdAt: "desc" },
            });
            assert(inv.status === "ACCEPTED" && inv.acceptedAt, "invitation should be ACCEPTED");

            const role = await prisma.userRole.findUnique({
              where: {
                userId_scopeType_scopeId: {
                  userId: user.id,
                  scopeType: "WORKSPACE",
                  scopeId: workspaceId,
                },
              },
            });
            assert(role?.role === "MEMBER", "WORKSPACE/MEMBER UserRole should be promoted");
          });

          await check("existing logged-in user accept grants role + keeps session", async () => {
            const created = await createInvite(accounts.viewer, [
              { scopeType: "PROJECT", scopeId: projectId, role: "VIEWER" },
            ]);
            const pmJar = await login(accounts.viewer, "Viewer");
            const before = pmJar.cookies.get("tf_session");
            const result = await request("/api/invitations/accept", {
              method: "POST",
              jar: pmJar,
              body: { token: created.token },
              expectedStatus: 200,
            });
            assert(result.json?.data?.isNewUser === false, "should be existing-user accept");
            assert(pmJar.cookies.get("tf_session") === before, "existing session must be preserved");

            const role = await prisma.userRole.findUnique({
              where: {
                userId_scopeType_scopeId: {
                  userId: pmUser.id,
                  scopeType: "PROJECT",
                  scopeId: projectId,
                },
              },
            });
            assert(role?.role === "VIEWER", "PROJECT/VIEWER UserRole should be granted");

            await prisma.userRole.deleteMany({
              where: { userId: pmUser.id, scopeType: "PROJECT", scopeId: projectId },
            });
            await prisma.invitation.deleteMany({ where: { email: accounts.viewer } });
          });

          await check("accept with mismatched logged-in email → INVITE_EMAIL_MISMATCH", async () => {
            const created = await createInvite(mismatchEmail, [
              { scopeType: "WORKSPACE", scopeId: workspaceId, role: "MEMBER" },
            ]);
            const result = await request("/api/invitations/accept", {
              method: "POST",
              jar: adminJar,
              body: { token: created.token },
              expectedStatus: 403,
            });
            assert(
              result.json?.error?.code === "INVITE_EMAIL_MISMATCH",
              "expected INVITE_EMAIL_MISMATCH",
            );
          });

          await check("accept revoked invitation → INVITE_REVOKED", async () => {
            const created = await createInvite(revokedEmail, [
              { scopeType: "WORKSPACE", scopeId: workspaceId, role: "MEMBER" },
            ]);
            await request(`/api/company/invitations/${created.id}/revoke`, {
              method: "POST",
              jar: adminJar,
              expectedStatus: 200,
            });
            const result = await request("/api/invitations/accept", {
              method: "POST",
              body: { token: created.token },
              expectedStatus: 400,
            });
            assert(result.json?.error?.code === "INVITE_REVOKED", "expected INVITE_REVOKED");
          });

          await check("expired invitation validate + accept → INVITE_EXPIRED", async () => {
            const created = await createInvite(expiredEmail, [
              { scopeType: "WORKSPACE", scopeId: workspaceId, role: "MEMBER" },
            ]);
            await prisma.invitation.update({
              where: { id: created.id },
              data: { expiresAt: new Date(Date.now() - 1000) },
            });
            const validate = await request("/api/invitations/validate", {
              method: "POST",
              body: { token: created.token },
              expectedStatus: 400,
            });
            assert(validate.json?.error?.code === "INVITE_EXPIRED", "validate expected INVITE_EXPIRED");
            const accept = await request("/api/invitations/accept", {
              method: "POST",
              body: { token: created.token },
              expectedStatus: 400,
            });
            assert(accept.json?.error?.code === "INVITE_EXPIRED", "accept expected INVITE_EXPIRED");
          });

          await check("existing user conflicting scope role → INVITE_ROLE_CONFLICT", async () => {
            // backend 는 WORKSPACE/MEMBER 보유 → 같은 scope 의 WORKSPACE/VIEWER 초대는 충돌.
            const created = await createInvite(accounts.member, [
              { scopeType: "WORKSPACE", scopeId: workspaceId, role: "VIEWER" },
            ]);
            const backendJar = await login(accounts.member, "Member");
            const result = await request("/api/invitations/accept", {
              method: "POST",
              jar: backendJar,
              body: { token: created.token },
              expectedStatus: 409,
            });
            assert(
              result.json?.error?.code === "INVITE_ROLE_CONFLICT",
              "expected INVITE_ROLE_CONFLICT",
            );
            assert(
              Array.isArray(result.json?.error?.conflicts) && result.json.error.conflicts.length > 0,
              "conflict detail should be included",
            );
            const role = await prisma.userRole.findUnique({
              where: {
                userId_scopeType_scopeId: {
                  userId: backendUser.id,
                  scopeType: "WORKSPACE",
                  scopeId: workspaceId,
                },
              },
            });
            assert(role?.role === "MEMBER", "existing role must be kept on conflict");
            await prisma.invitation.deleteMany({ where: { email: accounts.member } });
          });

          await check("raw invite token is never stored in DB (tokenHash only)", async () => {
            const created = await createInvite(rawEmail, [
              { scopeType: "WORKSPACE", scopeId: workspaceId, role: "MEMBER" },
            ]);
            const hash = createHash("sha256").update(created.token).digest("hex");
            const byHash = await prisma.invitation.findUnique({ where: { tokenHash: hash } });
            assert(byHash, "invitation should be found by sha256(token)");
            const byRaw = await prisma.invitation.findFirst({ where: { tokenHash: created.token } });
            assert(!byRaw, "raw token must not be stored");
          });
        } finally {
          const createdUser = await prisma.user.findUnique({
            where: { email: newEmail },
            select: { id: true },
          });

          if (createdUser) {
            await prisma.userRole.deleteMany({ where: { userId: createdUser.id } });
            await prisma.workspaceMember.deleteMany({ where: { userId: createdUser.id } });
            await prisma.session.deleteMany({ where: { userId: createdUser.id } });
          }

          await prisma.invitation.deleteMany({ where: { email: { in: testEmails } } });

          if (createdUser) {
            await prisma.user.delete({ where: { id: createdUser.id } }).catch(() => {});
          }

          await prisma.userRole.deleteMany({
            where: { userId: pmUser.id, scopeType: "PROJECT", scopeId: projectId },
          });
        }
      }

      // c8-2-hotfix: PROJECT-only 초대 수락 시 상위 Workspace 활성 멤버십 보장
      {
        const seededProjects = await prisma.project.findMany({
          where: { workspaceId },
          select: { id: true },
          orderBy: { createdAt: "asc" },
          take: 2,
        });
        const projA = seededProjects[0].id;
        const projB = seededProjects[1].id;

        // 기존 사용자 테스트용: pm 이 멤버가 아닌 별도 Workspace/Project 생성
        const altWorkspace = await prisma.workspace.create({
          data: { name: `Alt WS ${RUN_ID}`, slug: `alt-ws-${RUN_ID}`, companyId, timezone: "Asia/Seoul" },
        });
        const altProject = await prisma.project.create({
          data: { workspaceId: altWorkspace.id, name: `Alt Proj ${RUN_ID}`, slug: `alt-proj-${RUN_ID}` },
        });

        const projNewEmail = `projonly.new.${RUN_ID}@testflow.local`.toLowerCase();
        const projMultiEmail = `projonly.multi.${RUN_ID}@testflow.local`.toLowerCase();

        async function createInvite(email, roles) {
          const result = await request("/api/company/invitations", {
            method: "POST",
            jar: adminJar,
            body: { email, roles },
            expectedStatus: 201,
          });
          const token = new URL(`http://x${result.json.data.inviteUrl}`).searchParams.get("token");
          return { id: result.json.data.invitation.id, token };
        }

        try {
          await check("new user PROJECT-only accept auto-creates ACTIVE workspace membership", async () => {
            const created = await createInvite(projNewEmail, [
              { scopeType: "PROJECT", scopeId: projA, role: "VIEWER" },
            ]);
            const jar = new CookieJar();
            const result = await request("/api/invitations/accept", {
              method: "POST",
              jar,
              body: { token: created.token, name: "프로젝트 신규", password: "password123!" },
              expectedStatus: 201,
            });
            assert(result.json?.data?.isNewUser === true, "should be new-user accept");
            assert(jar.cookies.has("tf_session"), "session cookie should be set");

            const user = await prisma.user.findUnique({
              where: { email: projNewEmail },
              select: { id: true },
            });
            const projectRole = await prisma.userRole.findUnique({
              where: {
                userId_scopeType_scopeId: { userId: user.id, scopeType: "PROJECT", scopeId: projA },
              },
            });
            assert(projectRole?.role === "VIEWER", "PROJECT/VIEWER UserRole should be created");

            const membership = await prisma.workspaceMember.findUnique({
              where: { workspaceId_userId: { workspaceId, userId: user.id } },
            });
            assert(
              membership && membership.status === "ACTIVE" && membership.role === "MEMBER",
              "parent workspace membership (ACTIVE, MEMBER) should be auto-created",
            );

            // 새 세션으로 /api/auth/me 가 활성 Workspace 를 반환해야 한다.
            const me = await request("/api/auth/me", { jar, expectedStatus: 200 });
            assert(me.json?.data?.workspace?.id === workspaceId, "me should return the parent workspace");
          });

          await check("multiple PROJECT roles in same workspace create only one membership", async () => {
            const created = await createInvite(projMultiEmail, [
              { scopeType: "PROJECT", scopeId: projA, role: "VIEWER" },
              { scopeType: "PROJECT", scopeId: projB, role: "MEMBER" },
            ]);
            const jar = new CookieJar();
            await request("/api/invitations/accept", {
              method: "POST",
              jar,
              body: { token: created.token, name: "멀티 프로젝트", password: "password123!" },
              expectedStatus: 201,
            });

            const user = await prisma.user.findUnique({
              where: { email: projMultiEmail },
              select: { id: true },
            });
            const memberships = await prisma.workspaceMember.findMany({
              where: { userId: user.id, workspaceId },
            });
            assert(memberships.length === 1, `expected exactly 1 membership, got ${memberships.length}`);

            const projectRoles = await prisma.userRole.findMany({
              where: { userId: user.id, scopeType: "PROJECT", scopeId: { in: [projA, projB] } },
            });
            assert(projectRoles.length === 2, "both PROJECT UserRoles should be created");
          });

          await check("existing user PROJECT-only accept creates missing parent membership + keeps session", async () => {
            const created = await createInvite(accounts.viewer, [
              { scopeType: "PROJECT", scopeId: altProject.id, role: "VIEWER" },
            ]);

            const before = await prisma.workspaceMember.findUnique({
              where: { workspaceId_userId: { workspaceId: altWorkspace.id, userId: pmUser.id } },
            });
            assert(!before, "pm should not be a member of altWorkspace before accept");

            const pmJar = await login(accounts.viewer, "Viewer");
            const cookieBefore = pmJar.cookies.get("tf_session");
            const result = await request("/api/invitations/accept", {
              method: "POST",
              jar: pmJar,
              body: { token: created.token },
              expectedStatus: 200,
            });
            assert(result.json?.data?.isNewUser === false, "should be existing-user accept");
            assert(pmJar.cookies.get("tf_session") === cookieBefore, "existing session must be preserved");

            const membership = await prisma.workspaceMember.findUnique({
              where: { workspaceId_userId: { workspaceId: altWorkspace.id, userId: pmUser.id } },
            });
            assert(
              membership && membership.status === "ACTIVE" && membership.role === "MEMBER",
              "missing parent membership should be created (ACTIVE, MEMBER)",
            );

            const projectRole = await prisma.userRole.findUnique({
              where: {
                userId_scopeType_scopeId: {
                  userId: pmUser.id,
                  scopeType: "PROJECT",
                  scopeId: altProject.id,
                },
              },
            });
            assert(projectRole?.role === "VIEWER", "PROJECT/VIEWER UserRole should be created");
          });
        } finally {
          // 정리: 생성한 신규 User / pm grant / alt Workspace·Project / 초대.
          for (const email of [projNewEmail, projMultiEmail]) {
            const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
            if (user) {
              await prisma.userRole.deleteMany({ where: { userId: user.id } });
              await prisma.workspaceMember.deleteMany({ where: { userId: user.id } });
              await prisma.session.deleteMany({ where: { userId: user.id } });
              await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
            }
          }
          await prisma.userRole.deleteMany({
            where: { userId: pmUser.id, scopeType: "PROJECT", scopeId: altProject.id },
          });
          await prisma.workspaceMember.deleteMany({ where: { workspaceId: altWorkspace.id } });
          await prisma.invitation.deleteMany({
            where: { email: { in: [projNewEmail, projMultiEmail, accounts.viewer] } },
          });
          await prisma.project.delete({ where: { id: altProject.id } }).catch(() => {});
          await prisma.workspace.delete({ where: { id: altWorkspace.id } }).catch(() => {});
        }
      }

      // c9-2: 초대 수락 시 CompanyUserState(ACTIVE) 명시 생성 + INACTIVE 우회 방지
      {
        const project = await prisma.project.findFirst({
          where: { workspace: { companyId } },
          select: { id: true },
        });
        const projectId = project.id;
        const newEmail = `c92.new.${RUN_ID}@accept.local`.toLowerCase();
        let createdNewUserId = null;

        async function createInvite(email, roles) {
          const r = await request("/api/company/invitations", {
            method: "POST",
            jar: adminJar,
            body: { email, roles },
            expectedStatus: 201,
          });
          const token = new URL(`http://x${r.json.data.inviteUrl}`).searchParams.get("token");
          return { id: r.json.data.invitation.id, token };
        }

        const projectRoleKey = (userId) => ({
          userId_scopeType_scopeId: { userId, scopeType: "PROJECT", scopeId: projectId },
        });

        // 테스트 누적 accept/login 호출이 IP rate limit(127.0.0.1)에 걸리지 않도록 버킷 초기화.
        // (앱 동작 변경이 아니라 동일 IP 에서 다수 호출하는 테스트 한정 조치)
        await prisma.rateLimitBucket.deleteMany({
          where: { scope: { in: ["auth:invite-accept:ip", "auth:login:ip"] } },
        });

        try {
          await check("c9-2 new user accept creates ACTIVE CompanyUserState", async () => {
            const inv = await createInvite(newEmail, [
              { scopeType: "WORKSPACE", scopeId: workspaceId, role: "MEMBER" },
            ]);
            const jar = new CookieJar();
            const r = await request("/api/invitations/accept", {
              method: "POST",
              jar,
              body: { token: inv.token, name: "C92 New", password: "password123!" },
              expectedStatus: 201,
            });
            assert(r.json?.data?.isNewUser === true, "should be new-user accept");
            assert(jar.cookies.has("tf_session"), "session created");

            const user = await prisma.user.findUnique({
              where: { email: newEmail },
              select: { id: true },
            });
            createdNewUserId = user.id;
            const state = await prisma.companyUserState.findUnique({
              where: { companyId_userId: { companyId, userId: user.id } },
            });
            assert(state?.status === "ACTIVE", "CompanyUserState ACTIVE created for new user");
            const role = await prisma.userRole.findUnique({
              where: {
                userId_scopeType_scopeId: {
                  userId: user.id,
                  scopeType: "WORKSPACE",
                  scopeId: workspaceId,
                },
              },
            });
            assert(role?.role === "MEMBER", "UserRole promoted");
            const member = await prisma.workspaceMember.findUnique({
              where: { workspaceId_userId: { workspaceId, userId: user.id } },
            });
            assert(member, "WorkspaceMember ensured");
            const invRow = await prisma.invitation.findFirst({
              where: { email: newEmail },
              orderBy: { createdAt: "desc" },
            });
            assert(invRow.status === "ACCEPTED", "invitation ACCEPTED");
          });

          await check("c9-2 existing ACTIVE user accept keeps ACTIVE state", async () => {
            const inv = await createInvite(accounts.viewer, [
              { scopeType: "PROJECT", scopeId: projectId, role: "VIEWER" },
            ]);
            const pmJar = await login(accounts.viewer, "Viewer");
            await request("/api/invitations/accept", {
              method: "POST",
              jar: pmJar,
              body: { token: inv.token },
              expectedStatus: 200,
            });
            const state = await prisma.companyUserState.findUnique({
              where: { companyId_userId: { companyId, userId: pmUser.id } },
            });
            assert(state?.status === "ACTIVE", "pm state stays ACTIVE");
            await prisma.userRole.deleteMany({
              where: { userId: pmUser.id, scopeType: "PROJECT", scopeId: projectId },
            });
            await prisma.invitation.deleteMany({ where: { email: accounts.viewer } });
          });

          await check("c9-2 legacy user (no state) accept creates ACTIVE state", async () => {
            // backend 의 CompanyUserState 삭제로 legacy(상태 없음) 재현.
            await prisma.companyUserState.deleteMany({
              where: { companyId, userId: backendUser.id },
            });
            const inv = await createInvite(accounts.member, [
              { scopeType: "PROJECT", scopeId: projectId, role: "VIEWER" },
            ]);
            const beJar = await login(accounts.member, "Member");
            await request("/api/invitations/accept", {
              method: "POST",
              jar: beJar,
              body: { token: inv.token },
              expectedStatus: 200,
            });
            const state = await prisma.companyUserState.findUnique({
              where: { companyId_userId: { companyId, userId: backendUser.id } },
            });
            assert(state?.status === "ACTIVE", "legacy user state created ACTIVE");
            await prisma.userRole.deleteMany({
              where: { userId: backendUser.id, scopeType: "PROJECT", scopeId: projectId },
            });
            await prisma.invitation.deleteMany({ where: { email: accounts.member } });
          });

          await check("c9-2 INACTIVE user accept → 403 USER_INACTIVE, invitation stays PENDING, then activate succeeds", async () => {
            // 비활성화 전에 로그인(로그인은 상태와 무관).
            const beJar = await login(accounts.member, "Member");
            await prisma.companyUserState.update({
              where: { companyId_userId: { companyId, userId: backendUser.id } },
              data: { status: "INACTIVE", deactivatedAt: new Date() },
            });

            const inv = await createInvite(accounts.member, [
              { scopeType: "PROJECT", scopeId: projectId, role: "VIEWER" },
            ]);
            const blocked = await request("/api/invitations/accept", {
              method: "POST",
              jar: beJar,
              body: { token: inv.token },
              expectedStatus: 403,
            });
            assert(blocked.json?.error?.code === "USER_INACTIVE", "expected USER_INACTIVE");

            const invRow = await prisma.invitation.findUnique({ where: { id: inv.id } });
            assert(invRow.status === "PENDING", "invitation stays PENDING");
            const role = await prisma.userRole.findUnique({ where: projectRoleKey(backendUser.id) });
            assert(!role, "no UserRole added while INACTIVE");
            const state = await prisma.companyUserState.findUnique({
              where: { companyId_userId: { companyId, userId: backendUser.id } },
            });
            assert(state?.status === "INACTIVE", "state stays INACTIVE (no auto-reactivation)");

            // CO 가 활성화한 뒤 같은 초대 수락 → 성공.
            await prisma.companyUserState.update({
              where: { companyId_userId: { companyId, userId: backendUser.id } },
              data: { status: "ACTIVE", reactivatedAt: new Date() },
            });
            await request("/api/invitations/accept", {
              method: "POST",
              jar: beJar,
              body: { token: inv.token },
              expectedStatus: 200,
            });
            const invRow2 = await prisma.invitation.findUnique({ where: { id: inv.id } });
            assert(invRow2.status === "ACCEPTED", "after activation invitation ACCEPTED");
            const role2 = await prisma.userRole.findUnique({ where: projectRoleKey(backendUser.id) });
            assert(role2?.role === "VIEWER", "role promoted after activation");
          });
        } finally {
          await prisma.invitation.deleteMany({
            where: { email: { in: [newEmail, accounts.viewer, accounts.member] } },
          });
          await prisma.userRole.deleteMany({
            where: { userId: backendUser.id, scopeType: "PROJECT", scopeId: projectId },
          });
          await prisma.userRole.deleteMany({
            where: { userId: pmUser.id, scopeType: "PROJECT", scopeId: projectId },
          });
          // backend 상태를 seed 값(ACTIVE)으로 복구.
          await prisma.companyUserState.upsert({
            where: { companyId_userId: { companyId, userId: backendUser.id } },
            update: { status: "ACTIVE" },
            create: { companyId, userId: backendUser.id, status: "ACTIVE" },
          });
          if (createdNewUserId) {
            await prisma.userRole.deleteMany({ where: { userId: createdNewUserId } });
            await prisma.workspaceMember.deleteMany({ where: { userId: createdNewUserId } });
            await prisma.companyUserState.deleteMany({ where: { userId: createdNewUserId } });
            await prisma.session.deleteMany({ where: { userId: createdNewUserId } });
            await prisma.user.delete({ where: { id: createdNewUserId } }).catch(() => {});
          }
        }
      }

      // c9-3: Company 사용자 목록 검색·상태 필터·정렬·서버 페이지네이션
      {
        const tag = `c93-${RUN_ID}`;
        const base = Date.now();
        let otherCompanyId = null;
        const name = (i) => `${tag} U${String(i).padStart(2, "0")}`;
        const email = (i) => `c93.u${String(i).padStart(2, "0")}.${RUN_ID}@u.local`.toLowerCase();

        async function listUsers(jar, query, expectedStatus = 200) {
          return request(`/api/company/users${query ? `?${query}` : ""}`, { jar, expectedStatus });
        }

        try {
          // U01: legacy(상태 없음, demo WorkspaceMember) / U02: INACTIVE state-only(role·member 없음)
          // U03..U12: ACTIVE state. createdAt 은 U02 를 최대로 둬서 newest 가 nameDesc 와 구분되게 한다.
          for (let i = 1; i <= 12; i += 1) {
            const user = await prisma.user.create({
              data: { name: name(i), email: email(i), passwordHash: "x" },
            });
            if (i === 1) {
              await prisma.workspaceMember.create({
                data: { workspaceId, userId: user.id, role: "MEMBER", status: "ACTIVE" },
              });
            } else if (i === 2) {
              await prisma.companyUserState.create({
                data: {
                  companyId,
                  userId: user.id,
                  status: "INACTIVE",
                  createdAt: new Date(base + 1_000_000),
                },
              });
            } else {
              await prisma.companyUserState.create({
                data: {
                  companyId,
                  userId: user.id,
                  status: "ACTIVE",
                  createdAt: new Date(base + i * 1000),
                },
              });
            }
          }

          await check("company users: status filter counts (ACTIVE incl. legacy, INACTIVE state-only)", async () => {
            const all = await listUsers(adminJar, `q=${tag}`);
            assert(all.json?.data?.pagination?.total === 12, `ALL total should be 12, got ${all.json?.data?.pagination?.total}`);
            assert(Array.isArray(all.json.data.users), "users array preserved");

            const active = await listUsers(adminJar, `q=${tag}&status=ACTIVE`);
            assert(active.json.data.pagination.total === 11, "ACTIVE total should be 11 (legacy fallback included)");
            assert(
              active.json.data.users.some((u) => u.email === email(1)),
              "legacy(no state) user must appear under ACTIVE",
            );

            const inactive = await listUsers(adminJar, `q=${tag}&status=INACTIVE`);
            assert(inactive.json.data.pagination.total === 1, "INACTIVE total should be 1");
            assert(inactive.json.data.users[0]?.email === email(2), "state-only INACTIVE user must appear");
            // state-only INACTIVE 사용자는 UserRole/WorkspaceMember 가 없어도 목록에 보인다.
            assert(
              (inactive.json.data.users[0]?.roles ?? []).length === 0,
              "state-only user has no roles but is still listed",
            );
          });

          await check("company users: q name + email case-insensitive contains", async () => {
            const byName = await listUsers(adminJar, `q=${encodeURIComponent(name(5).toUpperCase())}`);
            assert(byName.json.data.pagination.total === 1, "name search should match exactly one");
            assert(byName.json.data.users[0]?.email === email(5), "name search returns U05");

            const byEmail = await listUsers(adminJar, `q=c93.U08`);
            assert(byEmail.json.data.pagination.total === 1, "email search should match exactly one");
            assert(byEmail.json.data.users[0]?.email === email(8), "email search returns U08");
          });

          await check("company users: server pagination meta + clamp", async () => {
            const p1 = await listUsers(adminJar, `q=${tag}&size=10&page=1`);
            const meta = p1.json.data.pagination;
            assert(meta.total === 12 && meta.size === 10 && meta.totalPages === 2, "page1 meta wrong");
            assert(meta.page === 1 && meta.hasPrevious === false && meta.hasNext === true, "page1 flags wrong");
            assert(p1.json.data.users.length === 10, "page1 should have 10 rows");

            const p2 = await listUsers(adminJar, `q=${tag}&size=10&page=2`);
            assert(p2.json.data.users.length === 2, "page2 should have 2 rows");

            const over = await listUsers(adminJar, `q=${tag}&size=10&page=99`);
            assert(over.json.data.pagination.page === 2, "overflow page should clamp to 2");
            assert(over.json.data.users.length === 2, "clamped page returns last page rows");
          });

          await check("company users: sort nameAsc/nameDesc/newest", async () => {
            const asc = await listUsers(adminJar, `q=${tag}&sort=nameAsc`);
            assert(asc.json.data.users[0]?.email === email(1), "nameAsc first should be U01");
            const desc = await listUsers(adminJar, `q=${tag}&sort=nameDesc`);
            assert(desc.json.data.users[0]?.email === email(12), "nameDesc first should be U12");
            const newest = await listUsers(adminJar, `q=${tag}&sort=newest`);
            assert(newest.json.data.users[0]?.email === email(2), "newest first should be U02 (max state createdAt)");
            // legacy(상태 없음) 는 newest 에서 마지막.
            const lastIdx = newest.json.data.users.length - 1;
            assert(
              newest.json.data.users[lastIdx]?.email === email(1),
              "legacy user should sort last under newest",
            );
          });

          await check("company users: invalid query params fall back to safe defaults", async () => {
            const r = await listUsers(adminJar, `q=${tag}&status=BOGUS&size=999&sort=weird&page=abc`);
            const d = r.json.data;
            assert(d.pagination.size === 20, "invalid size → 20");
            assert(d.pagination.page === 1, "invalid page → 1");
            assert(d.filters.status === "ALL", "invalid status → ALL");
            assert(d.filters.sort === "nameAsc", "invalid sort → nameAsc");
            assert(d.pagination.total === 12, "ALL fallback total should be 12");
          });

          await check("company users: non-CO with query is 403", async () => {
            const r = await listUsers(memberJar, `q=${tag}&status=ACTIVE&page=2`, 403);
            assert(r.json?.error?.code === "AUTH_FORBIDDEN", "expected AUTH_FORBIDDEN");
          });

          await check("company users: other-company users never included", async () => {
            const other = await prisma.company.create({
              data: { name: `C93 Other ${RUN_ID}`, slug: `c93-other-${RUN_ID}` },
            });
            otherCompanyId = other.id;
            const otherUser = await prisma.user.create({
              data: { name: `${tag} OtherCo`, email: `c93.otherco.${RUN_ID}@u.local`, passwordHash: "x" },
            });
            await prisma.companyUserState.create({
              data: { companyId: other.id, userId: otherUser.id, status: "ACTIVE" },
            });

            const r = await listUsers(adminJar, `q=${tag}`);
            assert(
              !r.json.data.users.some((u) => u.email === `c93.otherco.${RUN_ID}@u.local`),
              "other company user must not appear",
            );
            assert(r.json.data.pagination.total === 12, "other company user must not affect total");
          });
        } finally {
          await prisma.user.deleteMany({ where: { email: { contains: "c93." } } });
          if (otherCompanyId) {
            await prisma.company.delete({ where: { id: otherCompanyId } }).catch(() => {});
          }
        }
      }

      // c9-4: 비활성 Company 사용자 접근 제한 — /api/auth/me USER_INACTIVE 식별
      {
        await prisma.rateLimitBucket.deleteMany({ where: { scope: { in: ["auth:login:ip"] } } });
        const bePwHash = (
          await prisma.user.findUnique({ where: { email: accounts.member }, select: { passwordHash: true } })
        ).passwordHash;
        let tempUserId = null;
        let tempCompanyId = null;
        let tempWorkspaceId = null;
        let vUserId = null;

        try {
          await check("c9-4 unauthenticated /api/auth/me → 401 AUTH_UNAUTHORIZED", async () => {
            const r = await request("/api/auth/me", { expectedStatus: 401 });
            assert(r.json?.error?.code === "AUTH_UNAUTHORIZED", "expected AUTH_UNAUTHORIZED");
          });

          await check("c9-4 ACTIVE user /api/auth/me → 200 (workspace/role preserved)", async () => {
            const r = await request("/api/auth/me", { jar: adminJar, expectedStatus: 200 });
            assert(r.json?.data?.workspace?.id, "active user me should return workspace");
            assert(r.json?.data?.role, "active user me should return role");
          });

          await check("c9-4 INACTIVE-only user → me 403 USER_INACTIVE (no leak); project/dashboard 403; reactivate restores", async () => {
            await prisma.companyUserState.upsert({
              where: { companyId_userId: { companyId, userId: backendUser.id } },
              update: { status: "INACTIVE", deactivatedAt: new Date() },
              create: { companyId, userId: backendUser.id, status: "INACTIVE", deactivatedAt: new Date() },
            });

            const me = await request("/api/auth/me", { jar: memberJar, expectedStatus: 403 });
            assert(me.json?.error?.code === "USER_INACTIVE", "me should be USER_INACTIVE");
            assert(me.json?.data === undefined, "no auth payload leaked on USER_INACTIVE");
            assert(
              !("rolesByScope" in (me.json?.error ?? {})) && !("workspace" in (me.json?.error ?? {})),
              "error must not include role/workspace detail",
            );

            const proj = await request("/api/projects", { jar: memberJar, expectedStatus: 403 });
            assert(proj.json?.error?.code === "USER_INACTIVE", "projects should stay USER_INACTIVE");
            const dash = await request("/api/dashboard/summary", { jar: memberJar, expectedStatus: 403 });
            assert(dash.json?.error?.code === "USER_INACTIVE", "dashboard should stay USER_INACTIVE");

            // CO 가 재활성화 → 기존 세션으로 me 200 복구.
            await prisma.companyUserState.update({
              where: { companyId_userId: { companyId, userId: backendUser.id } },
              data: { status: "ACTIVE", reactivatedAt: new Date() },
            });
            const me2 = await request("/api/auth/me", { jar: memberJar, expectedStatus: 200 });
            assert(me2.json?.data?.workspace?.id, "me restored to 200 after reactivate");
          });

          await check("c9-4 multi-company: INACTIVE in one, ACTIVE in another → me 200 fallback (not USER_INACTIVE)", async () => {
            const other = await prisma.company.create({
              data: { name: `C94 Other ${RUN_ID}`, slug: `c94-other-${RUN_ID}` },
            });
            tempCompanyId = other.id;
            const otherWs = await prisma.workspace.create({
              data: { name: `C94 WS ${RUN_ID}`, slug: `c94-ws-${RUN_ID}`, companyId: other.id },
            });
            tempWorkspaceId = otherWs.id;
            const u = await prisma.user.create({
              data: { email: `c94.multi.${RUN_ID}@state.local`, name: "C94 Multi", passwordHash: bePwHash },
            });
            tempUserId = u.id;
            // demo(A): membership + INACTIVE state / other(B): membership + ACTIVE state.
            await prisma.workspaceMember.create({
              data: { workspaceId, userId: u.id, role: "MEMBER", status: "ACTIVE" },
            });
            await prisma.companyUserState.create({ data: { companyId, userId: u.id, status: "INACTIVE" } });
            await prisma.workspaceMember.create({
              data: { workspaceId: otherWs.id, userId: u.id, role: "MEMBER", status: "ACTIVE" },
            });
            await prisma.companyUserState.create({
              data: { companyId: other.id, userId: u.id, status: "ACTIVE" },
            });

            const jar = await loginRaw(u.email);
            const me = await request("/api/auth/me", { jar, expectedStatus: 200 });
            assert(
              me.json?.data?.workspace?.id === otherWs.id,
              "should fall back to ACTIVE company workspace (not USER_INACTIVE)",
            );
          });

          await check("c9-4 logged-in user with no active membership (not inactive) → me 401, not USER_INACTIVE", async () => {
            const v = await prisma.user.create({
              data: { email: `c94.nomem.${RUN_ID}@state.local`, name: "C94 NoMem", passwordHash: bePwHash },
            });
            vUserId = v.id;
            // 로그인 가능하도록 demo ACTIVE 멤버십 부여(상태 없음 → Company ACTIVE).
            await prisma.workspaceMember.create({
              data: { workspaceId, userId: v.id, role: "MEMBER", status: "ACTIVE" },
            });
            const jar = await loginRaw(v.email);
            // 활성 멤버십 제거(PENDING). Company 는 ACTIVE 유지 → INACTIVE 사유 아님.
            await prisma.workspaceMember.updateMany({ where: { userId: v.id }, data: { status: "PENDING" } });
            const me = await request("/api/auth/me", { jar, expectedStatus: 401 });
            assert(
              me.json?.error?.code === "AUTH_UNAUTHORIZED",
              `expected AUTH_UNAUTHORIZED (not USER_INACTIVE), got ${me.json?.error?.code}`,
            );
          });
        } finally {
          await prisma.companyUserState.upsert({
            where: { companyId_userId: { companyId, userId: backendUser.id } },
            update: { status: "ACTIVE" },
            create: { companyId, userId: backendUser.id, status: "ACTIVE" },
          });
          for (const id of [tempUserId, vUserId]) {
            if (id) {
              await prisma.companyUserState.deleteMany({ where: { userId: id } });
              await prisma.workspaceMember.deleteMany({ where: { userId: id } });
              await prisma.session.deleteMany({ where: { userId: id } });
              await prisma.user.delete({ where: { id } }).catch(() => {});
            }
          }
          if (tempWorkspaceId) {
            await prisma.workspace.delete({ where: { id: tempWorkspaceId } }).catch(() => {});
          }
          if (tempCompanyId) {
            await prisma.company.delete({ where: { id: tempCompanyId } }).catch(() => {});
          }
        }
      }

      // c9-5: deactivate/activate 감사 필드 + idempotent no-op 보존 + audit 로깅이 403을 깨지 않음
      {
        await prisma.rateLimitBucket.deleteMany({ where: { scope: { in: ["auth:login:ip"] } } });
        const targetId = pmUser.id; // 일반 사용자(viewer)를 대상으로 사용
        const coId = leadUser.id;
        const stateKey = { companyId_userId: { companyId, userId: targetId } };

        // baseline ACTIVE
        await prisma.companyUserState.upsert({
          where: stateKey,
          update: { status: "ACTIVE" },
          create: { companyId, userId: targetId, status: "ACTIVE" },
        });

        try {
          await check("c9-5 deactivate records audit fields (deactivatedAt/By = acting CO)", async () => {
            const r = await request(`/api/company/users/${targetId}/deactivate`, {
              method: "POST",
              jar: adminJar,
              expectedStatus: 200,
            });
            assert(r.json?.data?.status === "INACTIVE", "deactivate returns INACTIVE");
            const s = await prisma.companyUserState.findUnique({ where: stateKey });
            assert(s.status === "INACTIVE", "DB status INACTIVE");
            assert(s.deactivatedAt, "deactivatedAt recorded");
            assert(s.deactivatedByUserId === coId, "deactivatedByUserId === acting CO");
          });

          await check("c9-5 deactivate idempotent no-op preserves audit fields", async () => {
            const before = await prisma.companyUserState.findUnique({ where: stateKey });
            await request(`/api/company/users/${targetId}/deactivate`, {
              method: "POST",
              jar: adminJar,
              expectedStatus: 200,
            });
            const after = await prisma.companyUserState.findUnique({ where: stateKey });
            assert(
              after.deactivatedAt.getTime() === before.deactivatedAt.getTime(),
              "deactivatedAt must not be overwritten on no-op",
            );
            assert(
              after.deactivatedByUserId === before.deactivatedByUserId,
              "deactivatedByUserId must not change on no-op",
            );
          });

          await check("c9-5 audit logging does not break USER_INACTIVE 403 (access denied paths)", async () => {
            // 대상(pm)은 위에서 INACTIVE. 자기 세션으로 보호 API → 여전히 403 USER_INACTIVE.
            const pmJar = await login(accounts.viewer, "Viewer");
            const proj = await request("/api/projects", { jar: pmJar, expectedStatus: 403 });
            assert(proj.json?.error?.code === "USER_INACTIVE", "projects still USER_INACTIVE");
            const me = await request("/api/auth/me", { jar: pmJar, expectedStatus: 403 });
            assert(me.json?.error?.code === "USER_INACTIVE", "me still USER_INACTIVE");
          });

          await check("c9-5 activate records audit fields (reactivatedAt/By = acting CO)", async () => {
            const r = await request(`/api/company/users/${targetId}/activate`, {
              method: "POST",
              jar: adminJar,
              expectedStatus: 200,
            });
            assert(r.json?.data?.status === "ACTIVE", "activate returns ACTIVE");
            const s = await prisma.companyUserState.findUnique({ where: stateKey });
            assert(s.status === "ACTIVE", "DB status ACTIVE");
            assert(s.reactivatedAt, "reactivatedAt recorded");
            assert(s.reactivatedByUserId === coId, "reactivatedByUserId === acting CO");
          });

          await check("c9-5 activate idempotent no-op preserves audit fields", async () => {
            const before = await prisma.companyUserState.findUnique({ where: stateKey });
            await request(`/api/company/users/${targetId}/activate`, {
              method: "POST",
              jar: adminJar,
              expectedStatus: 200,
            });
            const after = await prisma.companyUserState.findUnique({ where: stateKey });
            assert(
              after.reactivatedAt.getTime() === before.reactivatedAt.getTime(),
              "reactivatedAt must not be overwritten on no-op",
            );
            assert(
              after.reactivatedByUserId === before.reactivatedByUserId,
              "reactivatedByUserId must not change on no-op",
            );
          });
        } finally {
          await prisma.companyUserState.upsert({
            where: stateKey,
            update: { status: "ACTIVE" },
            create: { companyId, userId: targetId, status: "ACTIVE" },
          });
        }
      }

      // c9-6: 영속 SecurityAuditEvent + DB 분산 throttle + cleanup
      {
        await prisma.rateLimitBucket.deleteMany({ where: { scope: { in: ["auth:login:ip"] } } });
        const bePwHash = (
          await prisma.user.findUnique({ where: { email: accounts.member }, select: { passwordHash: true } })
        ).passwordHash;
        let tId = null;
        const denyKey = (uid) => `INACTIVE_COMPANY_ACCESS_DENIED:${uid}:${companyId}`;

        try {
          const t = await prisma.user.create({
            data: { email: `c96.t.${RUN_ID}@audit.local`, name: "C96 Target", passwordHash: bePwHash },
          });
          tId = t.id;
          await prisma.workspaceMember.create({
            data: { workspaceId, userId: t.id, role: "MEMBER", status: "ACTIVE" },
          });
          await prisma.companyUserState.create({ data: { companyId, userId: t.id, status: "ACTIVE" } });

          await check("c9-6 deactivate persists COMPANY_USER_DEACTIVATED audit event", async () => {
            await request(`/api/company/users/${t.id}/deactivate`, {
              method: "POST",
              jar: adminJar,
              expectedStatus: 200,
            });
            const events = await prisma.securityAuditEvent.findMany({
              where: { targetUserId: t.id, eventType: "COMPANY_USER_DEACTIVATED" },
            });
            assert(events.length === 1, `expected 1 DEACTIVATED event, got ${events.length}`);
            const e = events[0];
            assert(e.actorUserId === leadUser.id, "actorUserId === acting CO");
            assert(e.companyId === companyId, "companyId recorded");
            assert(e.guardName === "company.users.deactivate", "guardName recorded");
            assert(e.metadata === null, "metadata null (no payload/sensitive data)");
          });

          await check("c9-6 access denied persists 1 event and DB-throttles repeats", async () => {
            const tJar = await loginRaw(t.email);
            for (let i = 0; i < 5; i += 1) {
              await request("/api/projects", { jar: tJar, expectedStatus: 403 });
            }
            const denied = await prisma.securityAuditEvent.findMany({
              where: { targetUserId: t.id, eventType: "INACTIVE_COMPANY_ACCESS_DENIED" },
            });
            assert(denied.length === 1, `expected exactly 1 access-denied event (throttled), got ${denied.length}`);
            assert(denied[0].companyId === companyId, "access-denied companyId");
            assert(denied[0].guardName, "access-denied guardName present");
            const throttle = await prisma.securityAuditThrottle.findUnique({
              where: { throttleKey: denyKey(t.id) },
            });
            assert(throttle, "throttle row created");
          });

          await check("c9-6 access denied emits again after throttle window passes", async () => {
            await prisma.securityAuditThrottle.update({
              where: { throttleKey: denyKey(t.id) },
              data: { lastEmittedAt: new Date(Date.now() - 3_600_000) },
            });
            const tJar = await loginRaw(t.email);
            await request("/api/projects", { jar: tJar, expectedStatus: 403 });
            const denied = await prisma.securityAuditEvent.findMany({
              where: { targetUserId: t.id, eventType: "INACTIVE_COMPANY_ACCESS_DENIED" },
            });
            assert(denied.length === 2, `expected 2 after window passes, got ${denied.length}`);
          });

          await check("c9-6 concurrent denied requests create at most 1 event per window", async () => {
            await prisma.securityAuditThrottle.deleteMany({ where: { throttleKey: denyKey(t.id) } });
            const before = await prisma.securityAuditEvent.count({
              where: { targetUserId: t.id, eventType: "INACTIVE_COMPANY_ACCESS_DENIED" },
            });
            const tJar = await loginRaw(t.email);
            const results = await Promise.all(
              Array.from({ length: 5 }, () => request("/api/projects", { jar: tJar })),
            );
            assert(
              results.every((r) => r.status === 403 && r.json?.error?.code === "USER_INACTIVE"),
              "all concurrent responses must stay 403 USER_INACTIVE",
            );
            const after = await prisma.securityAuditEvent.count({
              where: { targetUserId: t.id, eventType: "INACTIVE_COMPANY_ACCESS_DENIED" },
            });
            assert(after - before === 1, `expected exactly 1 new event under concurrency, got ${after - before}`);
          });

          await check("c9-6 activate persists REACTIVATED; idempotent no-op adds no event", async () => {
            await request(`/api/company/users/${t.id}/activate`, {
              method: "POST",
              jar: adminJar,
              expectedStatus: 200,
            });
            let events = await prisma.securityAuditEvent.findMany({
              where: { targetUserId: t.id, eventType: "COMPANY_USER_REACTIVATED" },
            });
            assert(events.length === 1, "expected 1 REACTIVATED event");
            assert(events[0].actorUserId === leadUser.id, "REACTIVATED actor === CO");

            await request(`/api/company/users/${t.id}/activate`, {
              method: "POST",
              jar: adminJar,
              expectedStatus: 200,
            });
            events = await prisma.securityAuditEvent.findMany({
              where: { targetUserId: t.id, eventType: "COMPANY_USER_REACTIVATED" },
            });
            assert(events.length === 1, "idempotent activate must not add a new event");
          });
        } finally {
          if (tId) {
            await prisma.securityAuditEvent.deleteMany({ where: { targetUserId: tId } });
            await prisma.securityAuditThrottle.deleteMany({ where: { throttleKey: denyKey(tId) } });
            await prisma.companyUserState.deleteMany({ where: { userId: tId } });
            await prisma.workspaceMember.deleteMany({ where: { userId: tId } });
            await prisma.session.deleteMany({ where: { userId: tId } });
            await prisma.user.delete({ where: { id: tId } }).catch(() => {});
          }
        }
      }

      // c9-6: retention cleanup script (dry-run / 실삭제 / env fallback)
      {
        const tag = `c96cleanup-${RUN_ID}`;
        const oldEvent = await prisma.securityAuditEvent.create({
          data: {
            eventType: "INACTIVE_COMPANY_ACCESS_DENIED",
            targetUserId: tag,
            occurredAt: new Date(Date.now() - 200 * 86_400_000), // 200일 전(기본 90일 retention 초과)
          },
        });
        const recentEvent = await prisma.securityAuditEvent.create({
          data: { eventType: "COMPANY_USER_DEACTIVATED", targetUserId: tag, occurredAt: new Date() },
        });
        const expiredThrottle = await prisma.securityAuditThrottle.create({
          data: {
            throttleKey: `exp-${RUN_ID}`,
            eventType: "INACTIVE_COMPANY_ACCESS_DENIED",
            lastEmittedAt: new Date(Date.now() - 3_600_000),
            expiresAt: new Date(Date.now() - 3_600_000),
          },
        });
        const validThrottle = await prisma.securityAuditThrottle.create({
          data: {
            throttleKey: `valid-${RUN_ID}`,
            eventType: "INACTIVE_COMPANY_ACCESS_DENIED",
            lastEmittedAt: new Date(),
            expiresAt: new Date(Date.now() + 3_600_000),
          },
        });

        async function runCleanup(extraArgs, extraEnv) {
          return new Promise((resolve, reject) => {
            const child = spawn("node", ["scripts/cleanup-security-audit.mjs", ...extraArgs], {
              env: { ...process.env, ...(extraEnv ?? {}) },
            });
            let out = "";
            child.stdout.on("data", (d) => {
              out += d.toString();
            });
            child.stderr.on("data", (d) => {
              out += d.toString();
            });
            child.on("close", (code) =>
              code === 0 ? resolve(out) : reject(new Error(`cleanup exited ${code}: ${out}`)),
            );
          });
        }

        try {
          await check("c9-6 audit:cleanup --dry-run reports targets without deleting", async () => {
            const out = await runCleanup(["--dry-run"]);
            assert(out.includes("dry-run"), "dry-run output expected");
            assert(await prisma.securityAuditEvent.findUnique({ where: { id: oldEvent.id } }), "old event kept on dry-run");
            assert(
              await prisma.securityAuditThrottle.findUnique({ where: { id: expiredThrottle.id } }),
              "expired throttle kept on dry-run",
            );
          });

          await check("c9-6 audit:cleanup deletes old events + expired throttles, keeps recent/valid", async () => {
            await runCleanup([]);
            assert(
              !(await prisma.securityAuditEvent.findUnique({ where: { id: oldEvent.id } })),
              "old event must be deleted",
            );
            assert(
              await prisma.securityAuditEvent.findUnique({ where: { id: recentEvent.id } }),
              "recent event must be kept",
            );
            assert(
              !(await prisma.securityAuditThrottle.findUnique({ where: { id: expiredThrottle.id } })),
              "expired throttle must be deleted",
            );
            assert(
              await prisma.securityAuditThrottle.findUnique({ where: { id: validThrottle.id } }),
              "valid throttle must be kept",
            );
          });

          await check("c9-6 audit:cleanup invalid SECURITY_AUDIT_RETENTION_DAYS falls back to 90", async () => {
            const out = await runCleanup(["--dry-run"], { SECURITY_AUDIT_RETENTION_DAYS: "not-a-number" });
            assert(out.includes("retentionDays=90"), "invalid retention should fall back to 90");
          });
        } finally {
          await prisma.securityAuditEvent.deleteMany({ where: { targetUserId: tag } });
          await prisma.securityAuditThrottle.deleteMany({
            where: { throttleKey: { in: [`exp-${RUN_ID}`, `valid-${RUN_ID}`] } },
          });
        }
      }

      // c9-7: Company 보안 감사 로그 조회 API
      {
        // 결정적 검증을 위해 깨끗한 상태에서 고정 fixture 를 만든다(이전 블록 잔여 이벤트 제거).
        await prisma.securityAuditEvent.deleteMany({});
        const deletedTargetId = `deleted-user-${RUN_ID}`;
        let otherCompanyId = null;

        async function mkEvent(data) {
          return prisma.securityAuditEvent.create({
            data: { ...data, occurredAt: new Date(data.occurredAt) },
          });
        }
        async function listAudit(jar, query, expectedStatus = 200) {
          return request(`/api/company/security-audit${query ? `?${query}` : ""}`, {
            jar,
            expectedStatus,
          });
        }

        try {
          const other = await prisma.company.create({
            data: { name: `C97 Other ${RUN_ID}`, slug: `c97-other-${RUN_ID}` },
          });
          otherCompanyId = other.id;

          // demo company 고정 이벤트 5건
          await mkEvent({ eventType: "COMPANY_USER_DEACTIVATED", occurredAt: "2026-06-10T12:00:00.000Z", guardName: "company.users.deactivate", actorUserId: leadUser.id, targetUserId: backendUser.id, companyId });
          await mkEvent({ eventType: "COMPANY_USER_DEACTIVATED", occurredAt: "2026-06-12T12:00:00.000Z", guardName: null, actorUserId: leadUser.id, targetUserId: backendUser.id, companyId });
          await mkEvent({ eventType: "COMPANY_USER_REACTIVATED", occurredAt: "2026-06-15T12:00:00.000Z", guardName: "company.users.activate", actorUserId: leadUser.id, targetUserId: backendUser.id, companyId });
          await mkEvent({ eventType: "INACTIVE_COMPANY_ACCESS_DENIED", occurredAt: "2026-06-20T12:00:00.000Z", guardName: "requireCurrentWorkspace", actorUserId: null, targetUserId: pmUser.id, companyId });
          await mkEvent({ eventType: "INACTIVE_COMPANY_ACCESS_DENIED", occurredAt: "2026-06-25T12:00:00.000Z", guardName: "auth.me", actorUserId: null, targetUserId: deletedTargetId, companyId });
          // 범위 밖: 타 Company + companyId null → 절대 포함되면 안 됨
          await mkEvent({ eventType: "INACTIVE_COMPANY_ACCESS_DENIED", occurredAt: "2026-06-22T12:00:00.000Z", guardName: "auth.me", actorUserId: null, targetUserId: pmUser.id, companyId: other.id });
          await mkEvent({ eventType: "INACTIVE_COMPANY_ACCESS_DENIED", occurredAt: "2026-06-23T12:00:00.000Z", guardName: "auth.me", actorUserId: null, targetUserId: pmUser.id, companyId: null });

          await check("c9-7 CO lists only current-company events (other company / null excluded)", async () => {
            const r = await listAudit(adminJar, "");
            assert(r.json?.data?.companyId === companyId, "companyId returned");
            assert(r.json.data.pagination.total === 5, `expected 5 demo events, got ${r.json.data.pagination.total}`);
            assert(Array.isArray(r.json.data.events), "events array");
          });

          await check("c9-7 non-CO → 403 AUTH_FORBIDDEN", async () => {
            const r = await listAudit(memberJar, "", 403);
            assert(r.json?.error?.code === "AUTH_FORBIDDEN", "expected AUTH_FORBIDDEN");
          });

          await check("c9-7 INACTIVE CO → 403 USER_INACTIVE", async () => {
            await prisma.userRole.upsert({
              where: { userId_scopeType_scopeId: { userId: backendUser.id, scopeType: "COMPANY", scopeId: companyId } },
              update: { role: "CO" },
              create: { userId: backendUser.id, scopeType: "COMPANY", scopeId: companyId, role: "CO" },
            });
            await prisma.companyUserState.upsert({
              where: { companyId_userId: { companyId, userId: backendUser.id } },
              update: { status: "INACTIVE" },
              create: { companyId, userId: backendUser.id, status: "INACTIVE" },
            });
            const r = await listAudit(memberJar, "", 403);
            assert(r.json?.error?.code === "USER_INACTIVE", "expected USER_INACTIVE");
            await prisma.companyUserState.update({
              where: { companyId_userId: { companyId, userId: backendUser.id } },
              data: { status: "ACTIVE" },
            });
            await prisma.userRole.deleteMany({
              where: { userId: backendUser.id, scopeType: "COMPANY", scopeId: companyId, role: "CO" },
            });
          });

          await check("c9-7 eventType filter counts", async () => {
            assert((await listAudit(adminJar, "eventType=COMPANY_USER_DEACTIVATED")).json.data.pagination.total === 2, "DEACTIVATED=2");
            assert((await listAudit(adminJar, "eventType=COMPANY_USER_REACTIVATED")).json.data.pagination.total === 1, "REACTIVATED=1");
            assert((await listAudit(adminJar, "eventType=INACTIVE_COMPANY_ACCESS_DENIED")).json.data.pagination.total === 2, "ACCESS_DENIED=2");
          });

          await check("c9-7 date from/to boundaries inclusive (UTC)", async () => {
            const mid = await listAudit(adminJar, "from=2026-06-15&to=2026-06-20");
            assert(mid.json.data.pagination.total === 2, `from/to range should be 2, got ${mid.json.data.pagination.total}`);
            const single = await listAudit(adminJar, "from=2026-06-25&to=2026-06-25");
            assert(single.json.data.pagination.total === 1, "single-day inclusive should be 1");
            assert(single.json.data.events[0].occurredAt.startsWith("2026-06-25"), "06-25 event returned");
          });

          await check("c9-7 from > to disables date filter (fallback)", async () => {
            const r = await listAudit(adminJar, "from=2026-06-25&to=2026-06-10");
            assert(r.json.data.pagination.total === 5, "from>to should disable date filter → all 5");
            assert(r.json.data.filters.from === null && r.json.data.filters.to === null, "filters cleared");
          });

          await check("c9-7 invalid query params fall back to safe defaults", async () => {
            const r = await listAudit(adminJar, "eventType=BOGUS&size=999&page=abc&sort=weird&from=2026-13-40");
            const d = r.json.data;
            assert(d.filters.eventType === "ALL", "invalid eventType → ALL");
            assert(d.pagination.size === 20 && d.pagination.page === 1, "invalid size/page fallback");
            assert(d.filters.sort === "newest", "invalid sort → newest");
            assert(d.filters.from === null, "invalid date ignored");
            assert(d.pagination.total === 5, "fallback total 5");
          });

          await check("c9-7 user search matches actor or target (name/email, case-insensitive)", async () => {
            const byActor = await listAudit(adminJar, `user=${encodeURIComponent("김QA")}`);
            assert(byActor.json.data.pagination.total === 3, `actor 김QA should match 3 (e1,e2,e3 actor), got ${byActor.json.data.pagination.total}`);
            const byTargetEmail = await listAudit(adminJar, "user=PM@TESTFLOW");
            assert(byTargetEmail.json.data.pagination.total === 1, "target email pm@ → 1 (the demo pm access-denied)");
          });

          await check("c9-7 deleted user appears with userId fallback (name/email null)", async () => {
            const r = await listAudit(adminJar, "eventType=INACTIVE_COMPANY_ACCESS_DENIED&sort=newest");
            const e = r.json.data.events.find((ev) => ev.target?.userId === deletedTargetId);
            assert(e, "deleted-target event present");
            assert(e.target.name === null && e.target.email === null, "deleted user name/email null");
            assert(e.target.userId === deletedTargetId, "deleted user userId kept");
            assert(e.actor === null, "actor null shown");
          });

          await check("c9-7 guard search case-insensitive contains; null guard excluded when querying", async () => {
            const r = await listAudit(adminJar, "guard=REQUIRECURRENT");
            assert(r.json.data.pagination.total === 1, "guard requireCurrent → 1");
            const company = await listAudit(adminJar, "guard=company");
            assert(company.json.data.pagination.total === 2, "guard 'company' → 2 (null guard excluded)");
          });

          await check("c9-7 sort newest/oldest + pagination meta + page clamp", async () => {
            const newest = await listAudit(adminJar, "sort=newest");
            assert(newest.json.data.events[0].occurredAt.startsWith("2026-06-25"), "newest first = 06-25");
            const oldest = await listAudit(adminJar, "sort=oldest");
            assert(oldest.json.data.events[0].occurredAt.startsWith("2026-06-10"), "oldest first = 06-10");
            const clamp = await listAudit(adminJar, "size=10&page=99");
            assert(clamp.json.data.pagination.page === 1 && clamp.json.data.pagination.totalPages === 1, "overflow page clamps to 1");
            assert(clamp.json.data.events.length === 5, "all 5 on single page");
          });

          await check("c9-7 response never exposes metadata/throttle/internal fields", async () => {
            const r = await listAudit(adminJar, "");
            const e = r.json.data.events[0];
            assert(!("metadata" in e), "no metadata");
            assert(!("throttleKey" in e) && !("expiresAt" in e) && !("lastEmittedAt" in e), "no throttle internals");
            assert(!("companyId" in e), "event row should not leak companyId per-row");
            const actorKeys = e.actor ? Object.keys(e.actor).sort().join(",") : "";
            if (e.actor) {
              assert(actorKeys === "email,name,userId", `actor DTO keys limited, got ${actorKeys}`);
            }
          });
        } finally {
          await prisma.securityAuditEvent.deleteMany({});
          await prisma.companyUserState.upsert({
            where: { companyId_userId: { companyId, userId: backendUser.id } },
            update: { status: "ACTIVE" },
            create: { companyId, userId: backendUser.id, status: "ACTIVE" },
          });
          await prisma.userRole.deleteMany({
            where: { userId: backendUser.id, scopeType: "COMPANY", scopeId: companyId, role: "CO" },
          });
          if (otherCompanyId) {
            await prisma.company.delete({ where: { id: otherCompanyId } }).catch(() => {});
          }
        }
      }

      // c9-8: 보안 감사 로그 summary + CSV export
      {
        await prisma.securityAuditEvent.deleteMany({});
        let otherCompanyId = null;
        let injectUserId = null;

        async function mkEvent(data) {
          return prisma.securityAuditEvent.create({
            data: { ...data, occurredAt: new Date(data.occurredAt) },
          });
        }
        async function listAudit(query) {
          return request(`/api/company/security-audit${query ? `?${query}` : ""}`, {
            jar: adminJar,
            expectedStatus: 200,
          });
        }
        async function exportAudit(jar, query, expectedStatus = 200) {
          return request(`/api/company/security-audit/export${query ? `?${query}` : ""}`, {
            jar,
            expectedStatus,
          });
        }

        try {
          const other = await prisma.company.create({
            data: { name: `C98 Other ${RUN_ID}`, slug: `c98-other-${RUN_ID}` },
          });
          otherCompanyId = other.id;
          const injectUser = await prisma.user.create({
            data: { name: "=SUM(1,1)", email: `+evil.${RUN_ID}@x.local`, passwordHash: "x" },
          });
          injectUserId = injectUser.id;

          // demo 5건
          await mkEvent({ eventType: "COMPANY_USER_DEACTIVATED", occurredAt: "2026-06-10T12:00:00.000Z", guardName: "company.users.deactivate", actorUserId: leadUser.id, targetUserId: backendUser.id, companyId });
          await mkEvent({ eventType: "COMPANY_USER_REACTIVATED", occurredAt: "2026-06-15T12:00:00.000Z", guardName: "company.users.activate", actorUserId: leadUser.id, targetUserId: backendUser.id, companyId });
          await mkEvent({ eventType: "INACTIVE_COMPANY_ACCESS_DENIED", occurredAt: "2026-06-20T12:00:00.000Z", guardName: "requireCurrentWorkspace", actorUserId: null, targetUserId: pmUser.id, companyId });
          await mkEvent({ eventType: "INACTIVE_COMPANY_ACCESS_DENIED", occurredAt: "2026-06-21T12:00:00.000Z", guardName: "=SUM(1,1)", actorUserId: null, targetUserId: injectUser.id, companyId });
          await mkEvent({ eventType: "INACTIVE_COMPANY_ACCESS_DENIED", occurredAt: "2026-06-22T12:00:00.000Z", guardName: 'a,b"c\nd', actorUserId: null, targetUserId: pmUser.id, companyId });
          // 범위 밖
          await mkEvent({ eventType: "INACTIVE_COMPANY_ACCESS_DENIED", occurredAt: "2026-06-23T12:00:00.000Z", guardName: "OTHERCOMPANY-guard", actorUserId: null, targetUserId: pmUser.id, companyId: other.id });
          await mkEvent({ eventType: "INACTIVE_COMPANY_ACCESS_DENIED", occurredAt: "2026-06-24T12:00:00.000Z", guardName: "NULLCOMPANY-guard", actorUserId: null, targetUserId: pmUser.id, companyId: null });

          await check("c9-8 summary counts (eventType excluded; total = byEventType sum)", async () => {
            const r = await listAudit("");
            const s = r.json.data.summary;
            assert(s.total === 5, `summary total 5, got ${s.total}`);
            assert(s.byEventType.COMPANY_USER_DEACTIVATED === 1, "DEACTIVATED 1");
            assert(s.byEventType.COMPANY_USER_REACTIVATED === 1, "REACTIVATED 1");
            assert(s.byEventType.INACTIVE_COMPANY_ACCESS_DENIED === 3, "ACCESS_DENIED 3");
            const sum = s.byEventType.COMPANY_USER_DEACTIVATED + s.byEventType.COMPANY_USER_REACTIVATED + s.byEventType.INACTIVE_COMPANY_ACCESS_DENIED;
            assert(sum === s.total, "byEventType sum === total");
          });

          await check("c9-8 eventType filter narrows list but summary stays full", async () => {
            const r = await listAudit("eventType=COMPANY_USER_DEACTIVATED");
            assert(r.json.data.pagination.total === 1, "list narrowed to 1");
            assert(r.json.data.summary.total === 5, "summary unaffected by eventType (still 5)");
          });

          await check("c9-8 summary applies date/user/guard filters", async () => {
            const byDate = await listAudit("from=2026-06-20&to=2026-06-22");
            assert(byDate.json.data.summary.total === 3, "date-filtered summary 3");
            const byUser = await listAudit(`user=${encodeURIComponent("박개발")}`);
            assert(byUser.json.data.summary.total === 2, "user backend summary 2");
            const byGuard = await listAudit("guard=requirecurrent");
            assert(byGuard.json.data.summary.total === 1, "guard summary 1");
          });

          await check("c9-8 summary excludes other-company / null-company events", async () => {
            const r = await listAudit("");
            assert(r.json.data.summary.total === 5, "summary scoped to current company only");
          });

          await check("c9-8 CO export → 200 CSV with BOM + header + scoped rows", async () => {
            const r = await exportAudit(adminJar, "");
            const ct = r.response.headers.get("content-type") ?? "";
            const cd = r.response.headers.get("content-disposition") ?? "";
            assert(ct.includes("text/csv"), `content-type text/csv, got ${ct}`);
            assert(/attachment; filename="security-audit-\d{8}-\d{6}\.csv"/.test(cd), `filename format, got ${cd}`);
            // BOM 은 raw bytes 로 확인(response.text() 는 디코딩 시 BOM 을 제거함).
            const rawRes = await fetch(new URL("/api/company/security-audit/export", BASE_URL), {
              headers: { Cookie: adminJar.header() },
            });
            const bytes = new Uint8Array(await rawRes.arrayBuffer());
            assert(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf, "UTF-8 BOM bytes (EF BB BF) present");
            assert(r.text.includes("발생 시각"), "header row present");
            const dataLines = r.text.replace(/^﻿/, "").split("\r\n").filter(Boolean);
            assert(dataLines.length === 6, `header + 5 data rows = 6 lines, got ${dataLines.length}`);
            assert(!r.text.includes("OTHERCOMPANY-guard") && !r.text.includes("NULLCOMPANY-guard"), "out-of-scope events excluded");
          });

          await check("c9-8 CSV formula injection prevented (=/+/-/@ prefixed with ')", async () => {
            const r = await exportAudit(adminJar, "eventType=INACTIVE_COMPANY_ACCESS_DENIED");
            assert(r.text.includes("'=SUM(1,1)"), "=SUM guard/name prefixed with '");
            assert(r.text.includes("'+evil."), "+email prefixed with '");
          });

          await check("c9-8 CSV escapes comma/quote/newline (RFC4180)", async () => {
            const r = await exportAudit(adminJar, "eventType=INACTIVE_COMPANY_ACCESS_DENIED");
            assert(r.text.includes('"a,b""c'), "comma/quote/newline guard wrapped + escaped");
          });

          await check("c9-8 CSV never exposes metadata/throttle/sensitive fields", async () => {
            const r = await exportAudit(adminJar, "");
            for (const banned of ["metadata", "throttleKey", "expiresAt", "lastEmittedAt", "password", "tokenHash", "inviteUrl", "cookie", companyId]) {
              assert(!r.text.includes(banned), `CSV must not contain "${banned}"`);
            }
          });

          await check("c9-8 empty result export → header-only CSV 200", async () => {
            const r = await exportAudit(adminJar, "from=2020-01-01&to=2020-01-02");
            const lines = r.text.replace(/^﻿/, "").split("\r\n").filter(Boolean);
            assert(lines.length === 1 && lines[0].includes("발생 시각"), "header-only CSV");
          });

          await check("c9-8 non-CO export 403; INACTIVE CO export 403 USER_INACTIVE", async () => {
            const nonCo = await exportAudit(memberJar, "", 403);
            assert(nonCo.json?.error?.code === "AUTH_FORBIDDEN", "non-CO AUTH_FORBIDDEN");
            // backend 를 INACTIVE CO 로
            await prisma.userRole.upsert({
              where: { userId_scopeType_scopeId: { userId: backendUser.id, scopeType: "COMPANY", scopeId: companyId } },
              update: { role: "CO" },
              create: { userId: backendUser.id, scopeType: "COMPANY", scopeId: companyId, role: "CO" },
            });
            await prisma.companyUserState.upsert({
              where: { companyId_userId: { companyId, userId: backendUser.id } },
              update: { status: "INACTIVE" },
              create: { companyId, userId: backendUser.id, status: "INACTIVE" },
            });
            const inactive = await exportAudit(memberJar, "", 403);
            assert(inactive.json?.error?.code === "USER_INACTIVE", "INACTIVE CO USER_INACTIVE");
            await prisma.companyUserState.update({ where: { companyId_userId: { companyId, userId: backendUser.id } }, data: { status: "ACTIVE" } });
            await prisma.userRole.deleteMany({ where: { userId: backendUser.id, scopeType: "COMPANY", scopeId: companyId, role: "CO" } });
          });

          await check("c9-8 export over limit → 422 SECURITY_AUDIT_EXPORT_LIMIT_EXCEEDED", async () => {
            // 현재 demo 5건 + 1건 = 6 > limit(5) → 422 (실제 10001건 생성 없이 검증)
            await mkEvent({ eventType: "COMPANY_USER_DEACTIVATED", occurredAt: "2026-06-26T12:00:00.000Z", guardName: "company.users.deactivate", actorUserId: leadUser.id, targetUserId: backendUser.id, companyId });
            const r = await exportAudit(adminJar, "", 422);
            assert(r.json?.error?.code === "SECURITY_AUDIT_EXPORT_LIMIT_EXCEEDED", "expected limit-exceeded code");
          });
        } finally {
          await prisma.securityAuditEvent.deleteMany({});
          await prisma.companyUserState.upsert({
            where: { companyId_userId: { companyId, userId: backendUser.id } },
            update: { status: "ACTIVE" },
            create: { companyId, userId: backendUser.id, status: "ACTIVE" },
          });
          await prisma.userRole.deleteMany({
            where: { userId: backendUser.id, scopeType: "COMPANY", scopeId: companyId, role: "CO" },
          });
          if (injectUserId) {
            await prisma.user.delete({ where: { id: injectUserId } }).catch(() => {});
          }
          if (otherCompanyId) {
            await prisma.company.delete({ where: { id: otherCompanyId } }).catch(() => {});
          }
        }
      }

      // c9-9: audit 화면 순수 URL/필터 helper 단위 검증 (서버/DB 불필요, 결정적).
      {
        const EVENT_LABELS = {
          COMPANY_USER_DEACTIVATED: "사용자 비활성화",
          COMPANY_USER_REACTIVATED: "사용자 활성화",
          INACTIVE_COMPANY_ACCESS_DENIED: "비활성 사용자 접근 차단",
        };
        const NOW = new Date("2026-06-15T00:00:00.000Z");
        const keysOf = (obj) => Object.keys(obj).sort().join(",");

        await check("c9-9 toggleEventTypePatch: ALL→type sets type + page 1", async () => {
          const p = toggleEventTypePatch("ALL", "COMPANY_USER_DEACTIVATED");
          assert(p && p.auditType === "COMPANY_USER_DEACTIVATED", "auditType set to clicked type");
          assert(p.auditPage === null, "auditPage reset to default (null)");
          assert(keysOf(p) === "auditPage,auditType", "only auditType/auditPage touched");
        });

        await check("c9-9 toggleEventTypePatch: same type re-click → ALL + page 1", async () => {
          const p = toggleEventTypePatch("COMPANY_USER_DEACTIVATED", "COMPANY_USER_DEACTIVATED");
          assert(p && p.auditType === null, "auditType cleared to ALL");
          assert(p.auditPage === null, "auditPage reset");
        });

        await check("c9-9 toggleEventTypePatch: ALL re-click → no-op (null, no history push)", async () => {
          assert(toggleEventTypePatch("ALL", "ALL") === null, "ALL re-click must be no-op");
        });

        await check("c9-9 toggleEventTypePatch: switch type replaces + page 1", async () => {
          const p = toggleEventTypePatch("COMPANY_USER_DEACTIVATED", "COMPANY_USER_REACTIVATED");
          assert(p && p.auditType === "COMPANY_USER_REACTIVATED", "auditType replaced");
          assert(p.auditPage === null, "auditPage reset");
        });

        await check("c9-9 buildActiveChips: all-default filters → 0 chips", async () => {
          const chips = buildActiveChips(
            { eventType: "ALL", from: "", to: "", user: "", guard: "", sort: "newest", size: 20 },
            EVENT_LABELS,
          );
          assert(chips.length === 0, `expected 0 chips, got ${chips.length}`);
        });

        await check("c9-9 buildActiveChips: each filter → chip w/ isolated removePatch", async () => {
          const chips = buildActiveChips(
            {
              eventType: "COMPANY_USER_DEACTIVATED",
              from: "2026-06-01",
              to: "2026-06-30",
              user: "alice",
              guard: "deactivate",
              sort: "oldest",
              size: 50,
            },
            EVENT_LABELS,
          );
          const byKey = Object.fromEntries(chips.map((c) => [c.key, c]));
          assert(chips.length === 6, `expected 6 chips, got ${chips.length}`);
          // 라벨
          assert(byKey.eventType.label === "사용자 비활성화", "eventType label localized");
          assert(byKey.date.label === "2026-06-01 ~ 2026-06-30", "date range label");
          assert(byKey.user.label === "사용자: alice", "user label");
          assert(byKey.guard.label === "Guard: deactivate", "guard label");
          assert(byKey.sort.label === "오래된순", "sort label");
          assert(byKey.size.label === "50개씩 보기", "size label");
          // removePatch 는 자기 key(+page)만 건드린다.
          assert(keysOf(byKey.eventType.removePatch) === "auditPage,auditType", "eventType removePatch isolated");
          assert(keysOf(byKey.date.removePatch) === "auditFrom,auditPage,auditTo", "date removePatch isolated");
          assert(keysOf(byKey.user.removePatch) === "auditPage,auditUser", "user removePatch isolated");
          assert(keysOf(byKey.guard.removePatch) === "auditGuard,auditPage", "guard removePatch isolated");
          assert(keysOf(byKey.sort.removePatch) === "auditPage,auditSort", "sort removePatch isolated");
          assert(keysOf(byKey.size.removePatch) === "auditPage,auditSize", "size removePatch isolated");
          // 모든 removePatch 값은 기본값(null) 이어야 한다(기본값 복귀).
          for (const c of chips) {
            for (const v of Object.values(c.removePatch)) {
              assert(v === null, `${c.key} removePatch values must be null`);
            }
          }
        });

        await check("c9-9 buildActiveChips: from-only / to-only date labels", async () => {
          const fromOnly = buildActiveChips(
            { eventType: "ALL", from: "2026-06-01", to: "", user: "", guard: "", sort: "newest", size: 20 },
            EVENT_LABELS,
          );
          assert(fromOnly.length === 1 && fromOnly[0].label === "2026-06-01 이후", "from-only label");
          const toOnly = buildActiveChips(
            { eventType: "ALL", from: "", to: "2026-06-30", user: "", guard: "", sort: "newest", size: 20 },
            EVENT_LABELS,
          );
          assert(toOnly.length === 1 && toOnly[0].label === "2026-06-30 이전", "to-only label");
        });

        await check("c9-9 activePreset + presetPatch UTC boundaries (today/7d/30d/all)", async () => {
          // today
          assert(JSON.stringify(presetPatch("today", NOW)) === JSON.stringify({ auditFrom: "2026-06-15", auditTo: "2026-06-15", auditPage: null }), "today patch");
          assert(activePreset("2026-06-15", "2026-06-15", NOW) === "today", "today active");
          // 7d = 6일 전 ~ 오늘
          assert(JSON.stringify(presetPatch("7d", NOW)) === JSON.stringify({ auditFrom: "2026-06-09", auditTo: "2026-06-15", auditPage: null }), "7d patch");
          assert(activePreset("2026-06-09", "2026-06-15", NOW) === "7d", "7d active");
          // 30d = 29일 전 ~ 오늘 (월 경계 넘김)
          assert(JSON.stringify(presetPatch("30d", NOW)) === JSON.stringify({ auditFrom: "2026-05-17", auditTo: "2026-06-15", auditPage: null }), "30d patch");
          assert(activePreset("2026-05-17", "2026-06-15", NOW) === "30d", "30d active");
          // all + 비프리셋
          assert(activePreset("", "", NOW) === "all", "empty → all");
          assert(activePreset("2026-01-01", "2026-02-01", NOW) === null, "arbitrary range → no preset");
        });

        await check("c9-9 exportButtonLabel: 0 / N / null / exporting", async () => {
          assert(exportButtonLabel(0, false) === "CSV 내보내기 (0건)", "0건 label");
          assert(exportButtonLabel(42, false) === "CSV 내보내기 (42건)", "N건 label");
          assert(exportButtonLabel(null, false) === "CSV 내보내기", "loading(null) label");
          assert(exportButtonLabel(5, true) === "내보내는 중…", "exporting label");
        });
      }

      // c10-1: 사용자 soft delete / 계정 탈퇴
      {
        const seedHash = (
          await prisma.user.findUnique({
            where: { email: accounts.admin },
            select: { passwordHash: true },
          })
        )?.passwordHash;
        assert(seedHash, "seed passwordHash needed for withdraw fixture");

        const nonexistentTargetId = `c10-ghost-${RUN_ID}`;
        let withdrawUser = null;
        let maskEventId = null;
        let ghostEventId = null;

        // 결정적 stale/race 세션 생성기(쿠키 raw token → sha256 tokenHash).
        async function createSessionFor(userId) {
          const rawToken = `c10tok-${RUN_ID}-${Math.floor(Math.random() * 1e9)}`;
          const tokenHash = createHash("sha256").update(rawToken).digest("hex");
          await prisma.session.create({
            data: {
              userId,
              tokenHash,
              expiresAt: new Date(Date.now() + 86_400_000),
              lastSeenAt: new Date(),
            },
          });
          const jar = new CookieJar();
          jar.cookies.set("tf_session", rawToken);
          return jar;
        }
        async function softDeleteAuditCount() {
          return prisma.securityAuditEvent.count({
            where: { eventType: "USER_SOFT_DELETED", targetUserId: withdrawUser.id },
          });
        }
        // c10-1 의 login/signup/withdraw 는 공유 IP rate-limit 버킷을 소진하지 않도록 전용 IP 로 격리한다.
        const C10_FWD = { "x-forwarded-for": "198.51.100.77" };
        async function c10LoginRaw(email) {
          const jar = new CookieJar();
          await request("/api/auth/login", {
            method: "POST",
            headers: C10_FWD,
            body: { email, password: PASSWORD },
            jar,
            expectedStatus: 200,
          });
          assert(jar.cookies.has("tf_session"), `${email} did not receive tf_session`);
          return jar;
        }

        try {
          withdrawUser = await prisma.user.create({
            data: {
              email: `withdraw.${RUN_ID}@x.local`,
              name: "탈퇴 테스터",
              passwordHash: seedHash,
            },
          });
          // 탈퇴 시 보존되어야 할 자원: 멤버십 + UserRole + CompanyUserState(ACTIVE).
          await prisma.workspaceMember.create({
            data: { workspaceId, userId: withdrawUser.id, role: "MEMBER", status: "ACTIVE" },
          });
          await prisma.userRole.create({
            data: { userId: withdrawUser.id, scopeType: "WORKSPACE", scopeId: workspaceId, role: "MEMBER" },
          });
          await prisma.companyUserState.create({
            data: { companyId, userId: withdrawUser.id, status: "ACTIVE" },
          });

          // A. schema/migration
          await check("c10-1 existing seed user has deletedAt null; enum accepts new values", async () => {
            const lead = await prisma.user.findUnique({
              where: { id: leadUser.id },
              select: { deletedAt: true },
            });
            assert(lead?.deletedAt === null, "seed user deletedAt must be null after migration");
            // USER_RESTORED enum 값이 DB 에서 사용 가능한지(USER_SOFT_DELETED 는 실제 탈퇴로 검증).
            const restoredEv = await prisma.securityAuditEvent.create({
              data: { eventType: "USER_RESTORED", actorUserId: leadUser.id, targetUserId: withdrawUser.id, guardName: "account.restore" },
            });
            assert(restoredEv.eventType === "USER_RESTORED", "USER_RESTORED enum usable");
            await prisma.securityAuditEvent.delete({ where: { id: restoredEv.id } });
          });

          // B. withdraw API
          await check("c10-1 unauthenticated withdraw → 401", async () => {
            const r = await request("/api/account/withdraw", {
              method: "POST",
              body: { confirmation: "탈퇴합니다" },
              expectedStatus: 401,
            });
            assert(r.json?.error?.code === "AUTH_UNAUTHORIZED", "expected AUTH_UNAUTHORIZED");
          });

          const userJar = await c10LoginRaw(withdrawUser.email);

          await check("c10-1 confirmation missing/mismatch → 400 ACCOUNT_WITHDRAWAL_CONFIRMATION_REQUIRED", async () => {
            const bad = await request("/api/account/withdraw", {
              method: "POST",
              jar: userJar,
              body: { confirmation: "탈퇴" },
              expectedStatus: 400,
            });
            assert(
              bad.json?.error?.code === "ACCOUNT_WITHDRAWAL_CONFIRMATION_REQUIRED",
              "expected confirmation-required code",
            );
            const missing = await request("/api/account/withdraw", {
              method: "POST",
              jar: userJar,
              body: {},
              expectedStatus: 400,
            });
            assert(
              missing.json?.error?.code === "ACCOUNT_WITHDRAWAL_CONFIRMATION_REQUIRED",
              "missing confirmation also 400",
            );
          });

          const preRoles = await prisma.userRole.count({ where: { userId: withdrawUser.id } });
          const preMembers = await prisma.workspaceMember.count({ where: { userId: withdrawUser.id } });

          await check("c10-1 self withdrawal: 200 {ok}, soft-deleted, sessions cleared, resources preserved, audit", async () => {
            const r = await request("/api/account/withdraw", {
              method: "POST",
              jar: userJar,
              body: { confirmation: "  탈퇴합니다  " }, // trim 후 비교
              expectedStatus: 200,
            });
            assert(r.json?.data?.ok === true, "expected { ok: true }");

            const u = await prisma.user.findUnique({ where: { id: withdrawUser.id } });
            assert(u?.deletedAt instanceof Date, "deletedAt set");
            assert(u?.deletedByUserId === withdrawUser.id, "deletedByUserId === self");
            assert(u?.deletionReason === "SELF_WITHDRAWAL", "deletionReason SELF_WITHDRAWAL");
            assert(u?.email === withdrawUser.email && u?.name === "탈퇴 테스터", "email/name preserved (no anonymize)");

            const sessionCount = await prisma.session.count({ where: { userId: withdrawUser.id } });
            assert(sessionCount === 0, "all sessions deleted");

            assert((await prisma.userRole.count({ where: { userId: withdrawUser.id } })) === preRoles, "UserRole preserved");
            assert((await prisma.workspaceMember.count({ where: { userId: withdrawUser.id } })) === preMembers, "WorkspaceMember preserved");
            const state = await prisma.companyUserState.findUnique({ where: { companyId_userId: { companyId, userId: withdrawUser.id } } });
            assert(state?.status === "ACTIVE", "CompanyUserState preserved (untouched)");

            const evs = await prisma.securityAuditEvent.findMany({ where: { eventType: "USER_SOFT_DELETED", targetUserId: withdrawUser.id } });
            assert(evs.length === 1, `exactly one USER_SOFT_DELETED, got ${evs.length}`);
            assert(evs[0].companyId === null, "global event companyId null");
            assert(evs[0].guardName === "account.withdraw", "guardName account.withdraw");
            assert(evs[0].actorUserId === withdrawUser.id, "actor === self");
          });

          await check("c10-1 post-withdrawal: old session me → 401; protected API blocked", async () => {
            const me = await request("/api/auth/me", { jar: userJar, expectedStatus: 401 });
            assert(me.json?.error?.code === "AUTH_UNAUTHORIZED", "old session is gone → 401");
            await request("/api/projects", { jar: userJar, expectedStatus: 401 });
          });

          await check("c10-1 stale/race session of deleted user → me 403 USER_ACCOUNT_DELETED", async () => {
            const stale = await createSessionFor(withdrawUser.id);
            const me = await request("/api/auth/me", { jar: stale, expectedStatus: 403 });
            assert(me.json?.error?.code === "USER_ACCOUNT_DELETED", "stale session → USER_ACCOUNT_DELETED");
            // guard 도 동일(회사 API)
            const co = await request("/api/company/security-audit", { jar: stale, expectedStatus: 403 });
            assert(co.json?.error?.code === "USER_ACCOUNT_DELETED", "guard → USER_ACCOUNT_DELETED");
          });

          await check("c10-1 idempotent re-withdraw: no overwrite, no duplicate audit", async () => {
            const before = await prisma.user.findUnique({ where: { id: withdrawUser.id }, select: { deletedAt: true } });
            const beforeCount = await softDeleteAuditCount();
            const stale = await createSessionFor(withdrawUser.id);
            const r = await request("/api/account/withdraw", {
              method: "POST",
              jar: stale,
              body: { confirmation: "탈퇴합니다" },
              expectedStatus: 200,
            });
            assert(r.json?.data?.ok === true, "idempotent { ok: true }");
            const after = await prisma.user.findUnique({ where: { id: withdrawUser.id }, select: { deletedAt: true } });
            assert(before.deletedAt.getTime() === after.deletedAt.getTime(), "deletedAt not overwritten");
            assert((await softDeleteAuditCount()) === beforeCount, "no duplicate USER_SOFT_DELETED audit");
          });

          await check("c10-1 login deleted account: correct pw → 403; wrong pw → 401 (existing contract)", async () => {
            const ok = await request("/api/auth/login", {
              method: "POST",
              headers: C10_FWD,
              body: { email: withdrawUser.email, password: PASSWORD },
              expectedStatus: 403,
            });
            assert(ok.json?.error?.code === "USER_ACCOUNT_DELETED", "correct pw → USER_ACCOUNT_DELETED");
            const wrong = await request("/api/auth/login", {
              method: "POST",
              headers: C10_FWD,
              body: { email: withdrawUser.email, password: "definitely-wrong-1!" },
              expectedStatus: 401,
            });
            assert(wrong.json?.error?.code === "AUTH_INVALID_CREDENTIALS", "wrong pw keeps 401 contract");
          });

          await check("c10-1 signup with deleted email → 403 USER_ACCOUNT_DELETED, no new user", async () => {
            const r = await request("/api/auth/signup", {
              method: "POST",
              headers: C10_FWD,
              body: { name: "재가입", email: withdrawUser.email, password: PASSWORD },
              expectedStatus: 403,
            });
            assert(r.json?.error?.code === "USER_ACCOUNT_DELETED", "signup blocked with USER_ACCOUNT_DELETED");
            const count = await prisma.user.count({ where: { email: withdrawUser.email } });
            assert(count === 1, "no new user row created (email stays unique to deleted user)");
          });

          // C. invitation
          const inviteToken = `c10inv-${RUN_ID}`;
          const invite = await prisma.invitation.create({
            data: {
              companyId,
              email: withdrawUser.email,
              tokenHash: createHash("sha256").update(inviteToken).digest("hex"),
              status: "PENDING",
              invitedByUserId: leadUser.id,
              expiresAt: new Date(Date.now() + 7 * 86_400_000),
            },
          });

          await check("c10-1 invite accept for deleted email → 403; invitation stays PENDING; no changes", async () => {
            const preRoleN = await prisma.userRole.count({ where: { userId: withdrawUser.id } });
            const r = await request("/api/invitations/accept", {
              method: "POST",
              body: { token: inviteToken },
              expectedStatus: 403,
            });
            assert(r.json?.error?.code === "USER_ACCOUNT_DELETED", "accept blocked with USER_ACCOUNT_DELETED");
            const inv = await prisma.invitation.findUnique({ where: { id: invite.id }, select: { status: true } });
            assert(inv?.status === "PENDING", "invitation remains PENDING");
            assert((await prisma.userRole.count({ where: { userId: withdrawUser.id } })) === preRoleN, "no UserRole change");
            assert((await prisma.session.count({ where: { userId: withdrawUser.id } })) >= 0, "no session created for deleted user");
          });

          await check("c10-1 invite validate does not leak deleted-account state", async () => {
            const r = await request("/api/invitations/validate", {
              method: "POST",
              body: { token: inviteToken },
              expectedStatus: 200,
            });
            const keys = Object.keys(r.json?.data ?? {});
            for (const leak of ["deleted", "deletedAt", "accountDeleted", "withdrawn", "deletionReason"]) {
              assert(!keys.includes(leak), `validate must not expose "${leak}"`);
            }
          });

          // D. company user management
          await check("c10-1 CO deactivate/activate/role-sync on deleted target → 409 USER_ACCOUNT_DELETED", async () => {
            const de = await request(`/api/company/users/${withdrawUser.id}/deactivate`, { method: "POST", jar: adminJar, expectedStatus: 409 });
            assert(de.json?.error?.code === "USER_ACCOUNT_DELETED", "deactivate → 409 USER_ACCOUNT_DELETED");
            const ac = await request(`/api/company/users/${withdrawUser.id}/activate`, { method: "POST", jar: adminJar, expectedStatus: 409 });
            assert(ac.json?.error?.code === "USER_ACCOUNT_DELETED", "activate → 409 USER_ACCOUNT_DELETED");
            const sync = await request(`/api/company/users/${withdrawUser.id}/roles/sync`, {
              method: "POST",
              jar: adminJar,
              body: { roles: [{ scopeType: "WORKSPACE", scopeId: workspaceId, role: "VIEWER" }] },
              expectedStatus: 409,
            });
            assert(sync.json?.error?.code === "USER_ACCOUNT_DELETED", "role sync → 409 USER_ACCOUNT_DELETED");
            // 전역 탈퇴 해제되지 않음(Company state 도 그대로).
            const u = await prisma.user.findUnique({ where: { id: withdrawUser.id }, select: { deletedAt: true } });
            assert(u?.deletedAt instanceof Date, "still soft-deleted after blocked actions");
          });

          await check("c10-1 company list + detail DTO expose accountDeleted=true", async () => {
            const list = await request(`/api/company/users?q=${encodeURIComponent(withdrawUser.email)}`, { jar: adminJar, expectedStatus: 200 });
            const row = (list.json?.data?.users ?? []).find((u) => u.userId === withdrawUser.id);
            assert(row && row.accountDeleted === true, "list DTO accountDeleted true");
            const detail = await request(`/api/company/users/${withdrawUser.id}`, { jar: adminJar, expectedStatus: 200 });
            assert(detail.json?.data?.accountDeleted === true, "detail DTO accountDeleted true");
          });

          // E. audit masking
          const maskEvent = await prisma.securityAuditEvent.create({
            data: { eventType: "COMPANY_USER_DEACTIVATED", companyId, actorUserId: leadUser.id, targetUserId: withdrawUser.id, guardName: "company.users.deactivate" },
          });
          maskEventId = maskEvent.id;
          const ghostEvent = await prisma.securityAuditEvent.create({
            data: { eventType: "COMPANY_USER_DEACTIVATED", companyId, actorUserId: leadUser.id, targetUserId: nonexistentTargetId, guardName: "company.users.deactivate" },
          });
          ghostEventId = ghostEvent.id;

          await check("c10-1 audit list masks withdrawn target (name/email null, withdrawn flag)", async () => {
            const r = await request("/api/company/security-audit?size=50", { jar: adminJar, expectedStatus: 200 });
            const events = r.json?.data?.events ?? [];
            const masked = events.find((e) => e.id === maskEventId);
            assert(masked, "mask event present in company audit");
            assert(masked.target.withdrawn === true, "withdrawn target flagged");
            assert(masked.target.name === null && masked.target.email === null, "withdrawn target name/email masked");
            assert(masked.target.userId === withdrawUser.id, "withdrawn target userId preserved");
            // 물리 삭제(row 없음) fallback 회귀: withdrawn=false, name/email null.
            const ghost = events.find((e) => e.id === ghostEventId);
            assert(ghost && ghost.target.withdrawn === false && ghost.target.name === null, "physical-deleted fallback unchanged");
          });

          await check("c10-1 CSV export shows 탈퇴한 사용자 and never leaks deleted user name/email", async () => {
            const r = await request("/api/company/security-audit/export", { jar: adminJar, expectedStatus: 200 });
            assert(r.text.includes("탈퇴한 사용자"), "CSV shows 탈퇴한 사용자 label");
            assert(!r.text.includes("탈퇴 테스터"), "CSV must not contain withdrawn user's name");
            assert(!r.text.includes(withdrawUser.email), "CSV must not contain withdrawn user's email");
          });

          // F. restore boundary
          await check("c10-1 no public restore endpoint (helper is MasterAdmin-only, not exposed)", async () => {
            await request("/api/account/restore", { method: "POST", body: { userId: withdrawUser.id }, expectedStatus: 404 });
          });

          await check("c10-1 restore semantics: MasterAdmin restore re-enables login; resources preserved; no auto-session", async () => {
            // c10-2: 실제 restore helper 를 admin route 를 통해 호출(직접 DB mimic 제거).
            await prisma.session.deleteMany({ where: { userId: withdrawUser.id } });
            const masterJar = await c10LoginRaw("master@testflow.local");
            // c10-5: 보호 admin API 는 step-up elevation 필요 → master 세션 재인증.
            await request("/api/admin/reauth", { method: "POST", jar: masterJar, headers: C10_FWD, body: { password: PASSWORD }, expectedStatus: 200 });
            const r = await request(`/api/admin/accounts/${withdrawUser.id}/restore`, {
              method: "POST",
              jar: masterJar,
              headers: C10_FWD,
              body: {},
              expectedStatus: 200,
            });
            assert(r.json?.data?.ok === true, "admin restore ok");
            assert((await prisma.session.count({ where: { userId: withdrawUser.id } })) === 0, "restore does not auto-create sessions");
            const u = await prisma.user.findUnique({ where: { id: withdrawUser.id } });
            assert(u?.deletedAt === null && u?.deletedByUserId === null && u?.deletionReason === null, "deleted fields cleared");
            const jar = await c10LoginRaw(withdrawUser.email);
            assert(jar.cookies.has("tf_session"), "restored user can log in again");
            assert((await prisma.userRole.count({ where: { userId: withdrawUser.id } })) >= 1, "UserRole preserved across withdraw+restore");
            assert((await prisma.workspaceMember.count({ where: { userId: withdrawUser.id } })) >= 1, "WorkspaceMember preserved");
            const state = await prisma.companyUserState.findUnique({ where: { companyId_userId: { companyId, userId: withdrawUser.id } } });
            assert(state?.status === "ACTIVE", "CompanyUserState preserved");
            assert((await prisma.securityAuditEvent.count({ where: { eventType: "USER_RESTORED", targetUserId: withdrawUser.id, actorUserId: { not: null } } })) === 1, "one USER_RESTORED audit");
          });
        } finally {
          // 정리: soft-deleted fixture 가 seed/기존 계정에 남지 않게 한다.
          await prisma.securityAuditEvent.deleteMany({
            where: { OR: [{ actorUserId: withdrawUser?.id }, { targetUserId: withdrawUser?.id }, { targetUserId: nonexistentTargetId }] },
          });
          await prisma.invitation.deleteMany({ where: { email: withdrawUser?.email } });
          if (withdrawUser) {
            // user 삭제 → sessions/roles/members/companyStates cascade.
            await prisma.user.delete({ where: { id: withdrawUser.id } }).catch(() => {});
          }
        }
      }

      // c10-1.1: 마지막 ACTIVE CO 자기 탈퇴 차단 (격리된 신규 Company/CO 로 demo 회사 미오염).
      {
        const seedHash = (
          await prisma.user.findUnique({ where: { email: accounts.admin }, select: { passwordHash: true } })
        )?.passwordHash;
        const FWD = { "x-forwarded-for": "198.51.100.91" };
        const userIds = [];
        const companyIds = [];
        const workspaceIds = [];

        async function login1011(email) {
          const jar = new CookieJar();
          await request("/api/auth/login", { method: "POST", headers: FWD, body: { email, password: PASSWORD }, jar, expectedStatus: 200 });
          assert(jar.cookies.has("tf_session"), `${email} login failed`);
          return jar;
        }
        async function mkCompany(tag) {
          const c = await prisma.company.create({ data: { name: `C1011-${tag} ${RUN_ID}`, slug: `c1011-${tag}-${RUN_ID}` } });
          const w = await prisma.workspace.create({ data: { name: `WS1011-${tag} ${RUN_ID}`, slug: `ws1011-${tag}-${RUN_ID}`, companyId: c.id } });
          companyIds.push(c.id);
          workspaceIds.push(w.id);
          return { company: c, workspace: w };
        }
        // CO user(+멤버십). withState=false 면 legacy(CompanyUserState 없음), status 로 ACTIVE/INACTIVE 지정.
        async function mkCo(tag, company, workspace, { withState = true, status = "ACTIVE" } = {}) {
          const u = await prisma.user.create({ data: { email: `co-${tag}.${RUN_ID}@x.local`, name: `CO ${tag}`, passwordHash: seedHash } });
          userIds.push(u.id);
          await prisma.workspaceMember.create({ data: { workspaceId: workspace.id, userId: u.id, role: "ADMIN", status: "ACTIVE" } });
          await prisma.userRole.create({ data: { userId: u.id, scopeType: "COMPANY", scopeId: company.id, role: "CO" } });
          if (withState) {
            await prisma.companyUserState.create({ data: { companyId: company.id, userId: u.id, status } });
          }
          return u;
        }

        try {
          const { company: c1, workspace: w1 } = await mkCompany("A");
          const coA = await mkCo("a", c1, w1, { withState: true, status: "ACTIVE" });

          await check("c10-1.1 sole ACTIVE CO self-withdrawal → 409, no state change", async () => {
            const jar = await login1011(coA.email);
            const r = await request("/api/account/withdraw", { method: "POST", jar, headers: FWD, body: { confirmation: "탈퇴합니다" }, expectedStatus: 409 });
            assert(r.json?.error?.code === "USER_LAST_CO_WITHDRAWAL_FORBIDDEN", "expected USER_LAST_CO_WITHDRAWAL_FORBIDDEN");
            const u = await prisma.user.findUnique({ where: { id: coA.id } });
            assert(u?.deletedAt === null && u?.deletedByUserId === null && u?.deletionReason === null, "no soft-delete fields set");
            assert((await prisma.session.count({ where: { userId: coA.id } })) >= 1, "session preserved (still logged in)");
            assert((await prisma.securityAuditEvent.count({ where: { eventType: "USER_SOFT_DELETED", targetUserId: coA.id } })) === 0, "no USER_SOFT_DELETED audit");
            assert((await prisma.userRole.count({ where: { userId: coA.id } })) === 1, "UserRole unchanged");
            assert((await prisma.workspaceMember.count({ where: { userId: coA.id } })) === 1, "WorkspaceMember unchanged");
          });

          // INACTIVE 다른 CO 는 ACTIVE 카운트에 미포함 → 여전히 마지막 ACTIVE CO.
          const coB = await mkCo("b", c1, w1, { withState: true, status: "INACTIVE" });
          await check("c10-1.1 INACTIVE other CO does not count → still 409", async () => {
            const jar = await login1011(coA.email);
            const r = await request("/api/account/withdraw", { method: "POST", jar, headers: FWD, body: { confirmation: "탈퇴합니다" }, expectedStatus: 409 });
            assert(r.json?.error?.code === "USER_LAST_CO_WITHDRAWAL_FORBIDDEN", "INACTIVE co does not rescue withdrawal");
          });

          // 다른 Company 에선 CO 가 더 있어도, 첫 Company 의 마지막 CO 이면 차단.
          const { company: c2, workspace: w2 } = await mkCompany("B");
          await prisma.userRole.create({ data: { userId: coA.id, scopeType: "COMPANY", scopeId: c2.id, role: "CO" } });
          await prisma.companyUserState.create({ data: { companyId: c2.id, userId: coA.id, status: "ACTIVE" } });
          await prisma.workspaceMember.create({ data: { workspaceId: w2.id, userId: coA.id, role: "ADMIN", status: "ACTIVE" } });
          await mkCo("c", c2, w2, { withState: true, status: "ACTIVE" }); // c2 의 다른 ACTIVE CO
          await check("c10-1.1 last CO in ONE company blocks withdrawal even if CO elsewhere has backup", async () => {
            const jar = await login1011(coA.email);
            const r = await request("/api/account/withdraw", { method: "POST", jar, headers: FWD, body: { confirmation: "탈퇴합니다" }, expectedStatus: 409 });
            assert(r.json?.error?.code === "USER_LAST_CO_WITHDRAWAL_FORBIDDEN", "company1 still last-CO → blocked");
          });

          // c1 에 두 번째 ACTIVE CO 확보(coB ACTIVE) → coA 는 어디서도 마지막 CO 아님 → 탈퇴 허용.
          await prisma.companyUserState.update({ where: { companyId_userId: { companyId: c1.id, userId: coB.id } }, data: { status: "ACTIVE" } });
          await check("c10-1.1 adding a 2nd ACTIVE CO unblocks withdrawal → 200 soft-delete + audit", async () => {
            const jar = await login1011(coA.email);
            const r = await request("/api/account/withdraw", { method: "POST", jar, headers: FWD, body: { confirmation: "탈퇴합니다" }, expectedStatus: 200 });
            assert(r.json?.data?.ok === true, "withdrawal now allowed");
            const u = await prisma.user.findUnique({ where: { id: coA.id } });
            assert(u?.deletedAt instanceof Date && u?.deletionReason === "SELF_WITHDRAWAL", "soft-deleted");
            assert((await prisma.session.count({ where: { userId: coA.id } })) === 0, "sessions deleted");
            assert((await prisma.securityAuditEvent.count({ where: { eventType: "USER_SOFT_DELETED", targetUserId: coA.id } })) === 1, "USER_SOFT_DELETED recorded");
          });

          // legacy: CompanyUserState 없는 단독 CO 도 ACTIVE 로 간주 → 차단(c9-1 fallback 일관).
          const { company: c3, workspace: w3 } = await mkCompany("L");
          const coLegacy = await mkCo("legacy", c3, w3, { withState: false });
          await check("c10-1.1 legacy CO without CompanyUserState is treated ACTIVE → sole CO 409", async () => {
            const jar = await login1011(coLegacy.email);
            const r = await request("/api/account/withdraw", { method: "POST", jar, headers: FWD, body: { confirmation: "탈퇴합니다" }, expectedStatus: 409 });
            assert(r.json?.error?.code === "USER_LAST_CO_WITHDRAWAL_FORBIDDEN", "legacy sole CO blocked (no-state = active)");
            const u = await prisma.user.findUnique({ where: { id: coLegacy.id } });
            assert(u?.deletedAt === null, "legacy CO not soft-deleted");
          });
        } finally {
          await prisma.securityAuditEvent.deleteMany({ where: { OR: [{ actorUserId: { in: userIds } }, { targetUserId: { in: userIds } }] } });
          for (const id of userIds) {
            await prisma.user.delete({ where: { id } }).catch(() => {});
          }
          for (const id of workspaceIds) {
            await prisma.workspace.delete({ where: { id } }).catch(() => {});
          }
          for (const id of companyIds) {
            await prisma.company.delete({ where: { id } }).catch(() => {});
          }
        }
      }

      // c10-2: MasterAdmin 탈퇴 계정 복구
      {
        const FWD = { "x-forwarded-for": "198.51.100.92" };
        const seedHash = (
          await prisma.user.findUnique({ where: { email: accounts.admin }, select: { passwordHash: true } })
        )?.passwordHash;
        const masterUserId = (
          await prisma.user.findUnique({ where: { email: "master@testflow.local" }, select: { id: true } })
        )?.id;
        const createdUserIds = [];
        let delMasterAdminEmail = null;

        async function c102Login(email) {
          const jar = new CookieJar();
          await request("/api/auth/login", { method: "POST", headers: FWD, body: { email, password: PASSWORD }, jar, expectedStatus: 200 });
          assert(jar.cookies.has("tf_session"), `${email} login failed`);
          return jar;
        }
        async function createSessionFor(userId) {
          const rawToken = `c102tok-${RUN_ID}-${Math.floor(Math.random() * 1e9)}`;
          const tokenHash = createHash("sha256").update(rawToken).digest("hex");
          await prisma.session.create({ data: { userId, tokenHash, expiresAt: new Date(Date.now() + 86_400_000), lastSeenAt: new Date() } });
          const jar = new CookieJar();
          jar.cookies.set("tf_session", rawToken);
          return jar;
        }
        async function mkDeleted(tag, { deletedAtISO, reason = "SELF_WITHDRAWAL", inactiveCompany = false } = {}) {
          const u = await prisma.user.create({
            data: {
              email: `del-${tag}.${RUN_ID}@x.local`,
              name: `삭제계정${tag}`,
              passwordHash: seedHash,
              deletedAt: new Date(deletedAtISO),
              deletedByUserId: leadUser.id,
              deletionReason: reason,
            },
          });
          createdUserIds.push(u.id);
          await prisma.workspaceMember.create({ data: { workspaceId, userId: u.id, role: "MEMBER", status: "ACTIVE" } });
          await prisma.userRole.create({ data: { userId: u.id, scopeType: "WORKSPACE", scopeId: workspaceId, role: "MEMBER" } });
          await prisma.companyUserState.create({ data: { companyId, userId: u.id, status: inactiveCompany ? "INACTIVE" : "ACTIVE" } });
          return u;
        }

        try {
          const masterJar = await c102Login("master@testflow.local");
          // c10-5: 보호 admin API 는 step-up elevation 이 필요 → 현재 master 세션을 재인증.
          await request("/api/admin/reauth", { method: "POST", jar: masterJar, headers: FWD, body: { password: PASSWORD }, expectedStatus: 200 });

          // A. guard / auth payload
          await check("c10-2 isMasterAdmin: master=true, CO/member=false", async () => {
            const m = await request("/api/auth/me", { jar: masterJar, expectedStatus: 200 });
            assert(m.json?.data?.isMasterAdmin === true, "master isMasterAdmin true");
            const co = await request("/api/auth/me", { jar: adminJar, expectedStatus: 200 });
            assert(co.json?.data?.isMasterAdmin === false, "CO isMasterAdmin false");
            const mem = await request("/api/auth/me", { jar: memberJar, expectedStatus: 200 });
            assert(mem.json?.data?.isMasterAdmin === false, "member isMasterAdmin false");
          });

          await check("c10-2 admin API: unauth → 401; non-Master CO/member → 403 AUTH_FORBIDDEN", async () => {
            const ul = await request("/api/admin/accounts/deleted", { expectedStatus: 401 });
            assert(ul.json?.error?.code === "AUTH_UNAUTHORIZED", "unauth list 401");
            const ur = await request(`/api/admin/accounts/${leadUser.id}/restore`, { method: "POST", expectedStatus: 401 });
            assert(ur.json?.error?.code === "AUTH_UNAUTHORIZED", "unauth restore 401");
            const col = await request("/api/admin/accounts/deleted", { jar: adminJar, expectedStatus: 403 });
            assert(col.json?.error?.code === "AUTH_FORBIDDEN", "CO list 403 (CO cannot bypass to master)");
            const cor = await request(`/api/admin/accounts/${leadUser.id}/restore`, { method: "POST", jar: adminJar, expectedStatus: 403 });
            assert(cor.json?.error?.code === "AUTH_FORBIDDEN", "CO restore 403");
            const meml = await request("/api/admin/accounts/deleted", { jar: memberJar, expectedStatus: 403 });
            assert(meml.json?.error?.code === "AUTH_FORBIDDEN", "member list 403");
          });

          await check("c10-2 soft-deleted MasterAdmin stale session → 403 USER_ACCOUNT_DELETED (priority)", async () => {
            const email = `delmaster.${RUN_ID}@x.local`;
            delMasterAdminEmail = email;
            const dm = await prisma.user.create({
              data: { email, name: "탈퇴마스터", passwordHash: seedHash, deletedAt: new Date(), deletedByUserId: leadUser.id, deletionReason: "SELF_WITHDRAWAL" },
            });
            createdUserIds.push(dm.id);
            await prisma.masterAdmin.create({ data: { email, name: "탈퇴마스터", passwordHash: seedHash } });
            const staleJar = await createSessionFor(dm.id);
            const r = await request("/api/admin/accounts/deleted", { jar: staleJar, expectedStatus: 403 });
            assert(r.json?.error?.code === "USER_ACCOUNT_DELETED", "deleted master → USER_ACCOUNT_DELETED, not master pass");
          });

          // B. deleted list
          const delA = await mkDeleted("a", { deletedAtISO: "2026-06-01T00:00:00.000Z", inactiveCompany: true });
          const delB = await mkDeleted("b", { deletedAtISO: "2026-06-02T00:00:00.000Z" });
          const delC = await mkDeleted("c", { deletedAtISO: "2026-06-03T00:00:00.000Z" });

          await check("c10-2 deleted list returns deleted users; active users excluded", async () => {
            const r = await request("/api/admin/accounts/deleted?size=50", { jar: masterJar, expectedStatus: 200 });
            const ids = r.json.data.users.map((u) => u.userId);
            assert(ids.includes(delA.id) && ids.includes(delB.id) && ids.includes(delC.id), "deleted users present");
            assert(!ids.includes(leadUser.id) && !ids.includes(backendUser.id), "active users excluded");
          });

          await check("c10-2 q search (case-insensitive email) + newest/oldest sort", async () => {
            const byEmail = await request(`/api/admin/accounts/deleted?q=${encodeURIComponent(`DEL-A.${RUN_ID}`)}`, { jar: masterJar, expectedStatus: 200 });
            assert(byEmail.json.data.users.length === 1 && byEmail.json.data.users[0].userId === delA.id, "case-insensitive email search → only delA");
            const newest = (await request("/api/admin/accounts/deleted?size=50&sort=newest", { jar: masterJar, expectedStatus: 200 })).json.data.users.filter((u) => [delA.id, delB.id, delC.id].includes(u.userId));
            assert(newest[0].userId === delC.id && newest[2].userId === delA.id, "newest = deletedAt DESC (delC..delA)");
            const oldest = (await request("/api/admin/accounts/deleted?size=50&sort=oldest", { jar: masterJar, expectedStatus: 200 })).json.data.users.filter((u) => [delA.id, delB.id, delC.id].includes(u.userId));
            assert(oldest[0].userId === delA.id && oldest[2].userId === delC.id, "oldest = deletedAt ASC (delA..delC)");
          });

          await check("c10-2 pagination (valid size 10, multi-page) + page overflow clamp", async () => {
            // size 는 10/20/50 만 유효 → 다중 page 검증을 위해 가벼운 deleted user 11명 추가.
            for (let i = 0; i < 11; i += 1) {
              const u = await prisma.user.create({
                data: {
                  email: `bulk-${i}.${RUN_ID}@x.local`,
                  name: `대량${i}`,
                  passwordHash: seedHash,
                  deletedAt: new Date(`2026-05-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`),
                  deletedByUserId: leadUser.id,
                  deletionReason: "SELF_WITHDRAWAL",
                },
              });
              createdUserIds.push(u.id);
            }
            const total = (await request("/api/admin/accounts/deleted?size=50", { jar: masterJar, expectedStatus: 200 })).json.data.pagination.total;
            assert(total > 10, `expected >10 deleted for multi-page, got ${total}`);
            const p1 = await request("/api/admin/accounts/deleted?size=10&page=1", { jar: masterJar, expectedStatus: 200 });
            assert(p1.json.data.users.length === 10 && p1.json.data.pagination.size === 10, "page1 = 10 rows, size honored");
            assert(p1.json.data.pagination.hasNext === true && p1.json.data.pagination.hasPrevious === false, "page1 nav flags");
            assert(p1.json.data.pagination.totalPages === Math.ceil(total / 10), "totalPages computed");
            const over = await request("/api/admin/accounts/deleted?size=10&page=999", { jar: masterJar, expectedStatus: 200 });
            assert(over.json.data.pagination.page === over.json.data.pagination.totalPages, "page overflow clamped to last page");
          });

          await check("c10-2 invalid query falls back to safe defaults", async () => {
            const r = await request("/api/admin/accounts/deleted?page=abc&size=7&sort=weird", { jar: masterJar, expectedStatus: 200 });
            assert(r.json.data.pagination.page === 1 && r.json.data.pagination.size === 20, "page/size fallback");
            assert(r.json.data.filters.sort === "newest", "sort fallback newest");
          });

          await check("c10-2 list DTO allowlist (no sensitive/role/company/session fields)", async () => {
            const r = await request(`/api/admin/accounts/deleted?q=${encodeURIComponent(`del-a.${RUN_ID}`)}`, { jar: masterJar, expectedStatus: 200 });
            const u = r.json.data.users[0];
            const keys = Object.keys(u).sort().join(",");
            assert(keys === "deletedAt,deletedByUserId,deletionReason,email,name,userId", `unexpected DTO keys: ${keys}`);
            for (const banned of ["passwordHash", "tokenHash", "avatarUrl", "lastLoginAt", "emailVerifiedAt", "roles", "metadata", "companyRoles"]) {
              assert(!r.text.includes(banned), `must not expose "${banned}"`);
            }
          });

          // C. restore
          await check("c10-2 restore: 200, fields null, no session, resources preserved, audit; removed from list", async () => {
            const r = await request(`/api/admin/accounts/${delB.id}/restore`, { method: "POST", jar: masterJar, headers: FWD, body: {}, expectedStatus: 200 });
            assert(r.json?.data?.ok === true, "restore ok");
            const u = await prisma.user.findUnique({ where: { id: delB.id } });
            assert(u?.deletedAt === null && u?.deletedByUserId === null && u?.deletionReason === null, "deleted fields cleared");
            assert((await prisma.session.count({ where: { userId: delB.id } })) === 0, "no session created");
            assert((await prisma.userRole.count({ where: { userId: delB.id } })) === 1, "UserRole preserved");
            assert((await prisma.workspaceMember.count({ where: { userId: delB.id } })) === 1, "WorkspaceMember preserved");
            assert(await prisma.companyUserState.findUnique({ where: { companyId_userId: { companyId, userId: delB.id } } }), "CompanyUserState preserved");
            const ev = await prisma.securityAuditEvent.findMany({ where: { eventType: "USER_RESTORED", targetUserId: delB.id } });
            assert(ev.length === 1, `exactly one USER_RESTORED, got ${ev.length}`);
            assert(ev[0].actorUserId === masterUserId, "actor = MasterAdmin user");
            assert(ev[0].companyId === null && ev[0].guardName === "admin.account.restore", "companyId null, guard admin.account.restore");
            const list = await request("/api/admin/accounts/deleted?size=50", { jar: masterJar, expectedStatus: 200 });
            assert(!list.json.data.users.some((x) => x.userId === delB.id), "restored user removed from deleted list");
          });

          await check("c10-2 restored user can login; INACTIVE-company access stays USER_INACTIVE", async () => {
            await request(`/api/admin/accounts/${delA.id}/restore`, { method: "POST", jar: masterJar, headers: FWD, body: {}, expectedStatus: 200 });
            const jar = await c102Login(`del-a.${RUN_ID}@x.local`);
            const me = await request("/api/auth/me", { jar, expectedStatus: 403 });
            assert(me.json?.error?.code === "USER_INACTIVE", "INACTIVE company access still blocked after restore");
          });

          await check("c10-2 already-active restore → 409 USER_ACCOUNT_NOT_DELETED (no dup audit); missing → 404", async () => {
            const before = await prisma.securityAuditEvent.count({ where: { eventType: "USER_RESTORED", targetUserId: delB.id } });
            const r = await request(`/api/admin/accounts/${delB.id}/restore`, { method: "POST", jar: masterJar, headers: FWD, body: {}, expectedStatus: 409 });
            assert(r.json?.error?.code === "USER_ACCOUNT_NOT_DELETED", "already-active → 409");
            assert((await prisma.securityAuditEvent.count({ where: { eventType: "USER_RESTORED", targetUserId: delB.id } })) === before, "no extra USER_RESTORED");
            const nf = await request(`/api/admin/accounts/nonexistent-${RUN_ID}/restore`, { method: "POST", jar: masterJar, headers: FWD, body: {}, expectedStatus: 404 });
            assert(nf.json?.error?.code === "USER_NOT_FOUND", "missing target → 404");
          });

          await check("c10-2 concurrent restore: exactly one 200, rest 409; one USER_RESTORED", async () => {
            const delConc = await mkDeleted("conc", { deletedAtISO: "2026-06-04T00:00:00.000Z" });
            const results = await Promise.all(
              [0, 1, 2].map(() => request(`/api/admin/accounts/${delConc.id}/restore`, { method: "POST", jar: masterJar, headers: FWD, body: {} })),
            );
            const ok = results.filter((r) => r.status === 200).length;
            const conflict = results.filter((r) => r.status === 409).length;
            assert(ok === 1, `exactly one 200, got ${ok}`);
            assert(ok + conflict === 3, `rest are 409 (ok=${ok}, conflict=${conflict})`);
            assert((await prisma.securityAuditEvent.count({ where: { eventType: "USER_RESTORED", targetUserId: delConc.id } })) === 1, "exactly one USER_RESTORED on real transition");
          });

          await check("c10-2 restore API does not alter caller session or create target session", async () => {
            const delX = await mkDeleted("x", { deletedAtISO: "2026-06-05T00:00:00.000Z" });
            await request(`/api/admin/accounts/${delX.id}/restore`, { method: "POST", jar: masterJar, headers: FWD, body: {}, expectedStatus: 200 });
            assert((await prisma.session.count({ where: { userId: delX.id } })) === 0, "target gets no session");
            // master session still valid after restore (no cookie/session mutation for caller).
            await request("/api/admin/accounts/deleted", { jar: masterJar, expectedStatus: 200 });
          });

          // D. UI helper (pure normalizers)
          await check("c10-2 admin filter normalizers + patch (pure)", async () => {
            assert(normalizeAdminDeletedSize("7") === 20 && normalizeAdminDeletedSize("50") === 50, "size fallback/valid");
            assert(normalizeAdminDeletedSort("weird") === "newest" && normalizeAdminDeletedSort("oldest") === "oldest", "sort fallback/valid");
            assert(normalizeAdminDeletedPage("0") === 1 && normalizeAdminDeletedPage("3") === 3, "page fallback/valid");
            assert(normalizeAdminDeletedQuery("  hi  ") === "hi" && normalizeAdminDeletedQuery(null) === "", "query trim");
            const patch = adminDeletedFilterPatch({ q: "  x  ", sort: "oldest", size: 50 });
            assert(patch.adminDeletedPage === null, "patch resets page");
            assert(patch.adminDeletedQ === "x" && patch.adminDeletedSort === "oldest" && patch.adminDeletedSize === 50, "patch values");
            assert(adminDeletedFilterPatch({ q: "" }).adminDeletedQ === null, "empty q → null (default strip)");
          });
        } finally {
          await prisma.securityAuditEvent.deleteMany({
            where: { OR: [{ targetUserId: { in: createdUserIds } }, { actorUserId: { in: createdUserIds } }] },
          });
          if (delMasterAdminEmail) {
            await prisma.masterAdmin.deleteMany({ where: { email: delMasterAdminEmail } });
          }
          for (const id of createdUserIds) {
            await prisma.user.delete({ where: { id } }).catch(() => {});
          }
        }
      }

      // c10-3: MasterAdmin 전역 보안 감사 콘솔
      {
        const FWD = { "x-forwarded-for": "198.51.100.93" };
        const markC = `c103-${RUN_ID}`;
        const markInj = `INJ-${RUN_ID}`;
        const ghostId = `c103-ghost-${RUN_ID}`;
        const seedHash = (
          await prisma.user.findUnique({ where: { email: accounts.admin }, select: { passwordHash: true } })
        )?.passwordHash;
        const masterUserId = (
          await prisma.user.findUnique({ where: { email: "master@testflow.local" }, select: { id: true } })
        )?.id;
        const ADMIN_LABELS = {
          COMPANY_USER_DEACTIVATED: "사용자 비활성화",
          COMPANY_USER_REACTIVATED: "사용자 활성화",
          INACTIVE_COMPANY_ACCESS_DENIED: "비활성 사용자 접근 차단",
          USER_SOFT_DELETED: "계정 탈퇴",
          USER_RESTORED: "계정 복구",
        };
        const SCOPE_LABELS = { COMPANY: "Company 이벤트", GLOBAL: "Global 이벤트" };

        const createdEventIds = [];
        const createdUserIds = [];
        let delMasterAdminEmail = null;

        async function c103Login(email) {
          const jar = new CookieJar();
          await request("/api/auth/login", { method: "POST", headers: FWD, body: { email, password: PASSWORD }, jar, expectedStatus: 200 });
          assert(jar.cookies.has("tf_session"), `${email} login failed`);
          return jar;
        }
        async function createSessionFor(userId) {
          const rawToken = `c103tok-${RUN_ID}-${Math.floor(Math.random() * 1e9)}`;
          const tokenHash = createHash("sha256").update(rawToken).digest("hex");
          await prisma.session.create({ data: { userId, tokenHash, expiresAt: new Date(Date.now() + 86_400_000), lastSeenAt: new Date() } });
          const jar = new CookieJar();
          jar.cookies.set("tf_session", rawToken);
          return jar;
        }
        async function mkEvent(data) {
          const e = await prisma.securityAuditEvent.create({ data: { ...data, occurredAt: new Date(data.occurredAt) } });
          createdEventIds.push(e.id);
          return e;
        }
        async function adminList(query) {
          return request(`/api/admin/security-audit${query ? `?${query}` : ""}`, { jar: masterJar, expectedStatus: 200 });
        }
        async function adminExport(jar, query, expectedStatus = 200) {
          return request(`/api/admin/security-audit/export${query ? `?${query}` : ""}`, { jar, expectedStatus });
        }

        let masterJar = null;
        try {
          masterJar = await c103Login("master@testflow.local");
          // c10-5: 보호 admin API 는 step-up elevation 이 필요 → 현재 master 세션을 재인증.
          await request("/api/admin/reauth", { method: "POST", jar: masterJar, headers: FWD, body: { password: PASSWORD }, expectedStatus: 200 });

          // soft-deleted user(마스킹용) + soft-deleted MasterAdmin(권한 우선순위용)
          const delUser = await prisma.user.create({
            data: { email: `del-audit.${RUN_ID}@x.local`, name: "탈퇴감사대상", passwordHash: seedHash, deletedAt: new Date(), deletedByUserId: leadUser.id, deletionReason: "SELF_WITHDRAWAL" },
          });
          createdUserIds.push(delUser.id);
          const delMasterEmail = `delmaster-audit.${RUN_ID}@x.local`;
          delMasterAdminEmail = delMasterEmail;
          const delMaster = await prisma.user.create({
            data: { email: delMasterEmail, name: "탈퇴마스터감사", passwordHash: seedHash, deletedAt: new Date(), deletedByUserId: leadUser.id, deletionReason: "SELF_WITHDRAWAL" },
          });
          createdUserIds.push(delMaster.id);
          await prisma.masterAdmin.create({ data: { email: delMasterEmail, name: "탈퇴마스터감사", passwordHash: seedHash } });

          // core set(markC): company 3 + global 3
          await mkEvent({ eventType: "COMPANY_USER_DEACTIVATED", companyId, actorUserId: leadUser.id, targetUserId: backendUser.id, guardName: `${markC}-deact`, occurredAt: "2026-06-10T12:00:00.000Z" });
          await mkEvent({ eventType: "COMPANY_USER_REACTIVATED", companyId, actorUserId: leadUser.id, targetUserId: backendUser.id, guardName: `${markC}-react`, occurredAt: "2026-06-11T12:00:00.000Z" });
          await mkEvent({ eventType: "INACTIVE_COMPANY_ACCESS_DENIED", companyId, actorUserId: null, targetUserId: pmUser.id, guardName: `${markC}-deny`, occurredAt: "2026-06-12T12:00:00.000Z" });
          await mkEvent({ eventType: "USER_SOFT_DELETED", companyId: null, actorUserId: delUser.id, targetUserId: delUser.id, guardName: `${markC}-withdraw`, occurredAt: "2026-06-13T12:00:00.000Z" });
          await mkEvent({ eventType: "USER_RESTORED", companyId: null, actorUserId: masterUserId, targetUserId: leadUser.id, guardName: `${markC}-restore`, occurredAt: "2026-06-14T12:00:00.000Z" });
          await mkEvent({ eventType: "USER_SOFT_DELETED", companyId: null, actorUserId: null, targetUserId: ghostId, guardName: `${markC}-ghost`, occurredAt: "2026-06-15T12:00:00.000Z" });
          // injection/escape set(markInj)
          await mkEvent({ eventType: "USER_RESTORED", companyId: null, actorUserId: null, targetUserId: null, guardName: `=${markInj}`, occurredAt: "2026-06-16T12:00:00.000Z" });
          await mkEvent({ eventType: "USER_RESTORED", companyId: null, actorUserId: null, targetUserId: null, guardName: `${markInj}-a,b"x`, occurredAt: "2026-06-17T12:00:00.000Z" });

          // A. permission
          await check("c10-3 permission: master 200; unauth 401; CO/member 403; deleted master 403", async () => {
            await request("/api/admin/security-audit", { jar: masterJar, expectedStatus: 200 });
            await adminExport(masterJar, `guard=${markC}&scope=GLOBAL`, 200);
            assert((await request("/api/admin/security-audit", { expectedStatus: 401 })).json?.error?.code === "AUTH_UNAUTHORIZED", "unauth list 401");
            assert((await request("/api/admin/security-audit/export", { expectedStatus: 401 })).json?.error?.code === "AUTH_UNAUTHORIZED", "unauth export 401");
            assert((await request("/api/admin/security-audit", { jar: adminJar, expectedStatus: 403 })).json?.error?.code === "AUTH_FORBIDDEN", "CO list 403");
            assert((await request("/api/admin/security-audit/export", { jar: adminJar, expectedStatus: 403 })).json?.error?.code === "AUTH_FORBIDDEN", "CO export 403");
            assert((await request("/api/admin/security-audit", { jar: memberJar, expectedStatus: 403 })).json?.error?.code === "AUTH_FORBIDDEN", "member list 403");
            const staleJar = await createSessionFor(delMaster.id);
            assert((await request("/api/admin/security-audit", { jar: staleJar, expectedStatus: 403 })).json?.error?.code === "USER_ACCOUNT_DELETED", "deleted master → USER_ACCOUNT_DELETED");
          });

          // B. scope + filters
          await check("c10-3 ALL includes company+global; scope=COMPANY/GLOBAL filter", async () => {
            const all = await adminList(`guard=${markC}&size=50`);
            assert(all.json.data.pagination.total === 6, `ALL total 6, got ${all.json.data.pagination.total}`);
            const scopes = new Set(all.json.data.events.map((e) => e.scope));
            assert(scopes.has("COMPANY") && scopes.has("GLOBAL"), "both scopes present");
            const co = await adminList(`guard=${markC}&scope=COMPANY&size=50`);
            assert(co.json.data.pagination.total === 3 && co.json.data.events.every((e) => e.scope === "COMPANY" && e.company), "scope COMPANY = companyId not null");
            const gl = await adminList(`guard=${markC}&scope=GLOBAL&size=50`);
            assert(gl.json.data.pagination.total === 3 && gl.json.data.events.every((e) => e.scope === "GLOBAL" && e.company === null), "scope GLOBAL = companyId null");
          });

          await check("c10-3 eventType/date/user/guard/sort filters", async () => {
            assert((await adminList(`guard=${markC}&eventType=USER_SOFT_DELETED&size=50`)).json.data.pagination.total === 2, "eventType USER_SOFT_DELETED = 2");
            assert((await adminList(`guard=${markC}&from=2026-06-14&to=2026-06-15&size=50`)).json.data.pagination.total === 2, "date range = 2");
            const byUser = await adminList(`guard=${markC}&user=${encodeURIComponent("탈퇴감사대상")}&size=50`);
            assert(byUser.json.data.pagination.total === 1 && byUser.json.data.events[0].guardName === `${markC}-withdraw`, "user search matches actor/target");
            const byGuard = await adminList(`guard=${markC}-deny&size=50`);
            assert(byGuard.json.data.pagination.total === 1 && byGuard.json.data.events[0].eventType === "INACTIVE_COMPANY_ACCESS_DENIED", "guard contains");
            assert((await adminList(`guard=${markC}&sort=newest&size=50`)).json.data.events[0].guardName === `${markC}-ghost`, "newest first = latest");
            assert((await adminList(`guard=${markC}&sort=oldest&size=50`)).json.data.events[0].guardName === `${markC}-deact`, "oldest first = earliest");
          });

          await check("c10-3 summary: eventType excluded, scope/guard applied, 5 keys", async () => {
            const s = (await adminList(`guard=${markC}&size=50`)).json.data.summary;
            assert(s.total === 6, "summary total 6");
            assert(s.byEventType.COMPANY_USER_DEACTIVATED === 1 && s.byEventType.COMPANY_USER_REACTIVATED === 1 && s.byEventType.INACTIVE_COMPANY_ACCESS_DENIED === 1 && s.byEventType.USER_SOFT_DELETED === 2 && s.byEventType.USER_RESTORED === 1, "byEventType counts");
            assert(Object.values(s.byEventType).reduce((a, b) => a + b, 0) === s.total, "sum === total");
            const narrowed = await adminList(`guard=${markC}&eventType=USER_SOFT_DELETED&size=50`);
            assert(narrowed.json.data.pagination.total === 2 && narrowed.json.data.summary.total === 6, "eventType narrows list, summary stays full");
            assert((await adminList(`guard=${markC}&scope=GLOBAL&size=50`)).json.data.summary.total === 3, "scope GLOBAL summary 3");
          });

          await check("c10-3 pagination overflow clamp + invalid query fallback", async () => {
            const over = await adminList(`guard=${markC}&size=10&page=999`);
            assert(over.json.data.pagination.page === over.json.data.pagination.totalPages, "overflow clamp");
            const inv = await adminList(`guard=${markC}&page=abc&size=7&sort=weird&scope=nope&eventType=bad`);
            assert(inv.json.data.pagination.size === 20 && inv.json.data.pagination.page === 1, "size/page fallback");
            assert(inv.json.data.filters.sort === "newest" && inv.json.data.filters.scope === "ALL" && inv.json.data.filters.eventType === "ALL", "sort/scope/eventType fallback");
          });

          await check("c10-3 masking: soft-deleted withdrawn; physical-deleted fallback; null actor", async () => {
            const e4 = (await adminList(`guard=${markC}-withdraw&size=50`)).json.data.events[0];
            assert(e4.target.withdrawn === true && e4.target.name === null && e4.target.email === null, "soft-deleted target masked");
            assert(e4.target.userId === delUser.id, "userId preserved");
            const e6 = (await adminList(`guard=${markC}-ghost&size=50`)).json.data.events[0];
            assert(e6.target.withdrawn === false && e6.target.name === null && e6.actor === null, "physical-deleted fallback + null actor");
          });

          await check("c10-3 company name bulk-resolved for COMPANY; null for GLOBAL", async () => {
            const co = await adminList(`guard=${markC}&scope=COMPANY&size=50`);
            assert(co.json.data.events.every((e) => e.company && e.company.companyId === companyId && typeof e.company.companyName === "string"), "company id+name present");
            assert((await adminList(`guard=${markC}&scope=GLOBAL&size=50`)).json.data.events.every((e) => e.company === null), "global company null");
          });

          // C. export
          await check("c10-3 export same filter as list (scope GLOBAL)", async () => {
            const list = await adminList(`guard=${markC}&scope=GLOBAL&size=50`);
            const csv = await adminExport(masterJar, `guard=${markC}&scope=GLOBAL`);
            const rows = csv.text.replace(/^﻿/, "").split("\r\n").filter(Boolean).length - 1;
            assert(rows === list.json.data.pagination.total, `CSV data rows(${rows}) === list total(${list.json.data.pagination.total})`);
          });

          await check("c10-3 CSV BOM (raw bytes) + formula injection + RFC4180 escape", async () => {
            const rawRes = await fetch(new URL(`/api/admin/security-audit/export?guard=${markInj}`, BASE_URL), { headers: { Cookie: masterJar.header() } });
            const bytes = new Uint8Array(await rawRes.arrayBuffer());
            assert(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf, "UTF-8 BOM bytes");
            const csv = await adminExport(masterJar, `guard=${markInj}`);
            assert(csv.text.includes(`'=${markInj}`), "formula injection prefixed with '");
            assert(csv.text.includes(`"${markInj}-a,b""x"`), "RFC4180 escaped");
          });

          await check("c10-3 CSV scope/company columns (GLOBAL no companyId; COMPANY includes it)", async () => {
            const glCsv = await adminExport(masterJar, `guard=${markC}&scope=GLOBAL`);
            assert(glCsv.text.includes("GLOBAL") && !glCsv.text.includes(companyId), "GLOBAL rows, no companyId");
            const coCsv = await adminExport(masterJar, `guard=${markC}&scope=COMPANY`);
            assert(coCsv.text.includes("COMPANY") && coCsv.text.includes(companyId), "COMPANY rows include companyId");
          });

          await check("c10-3 list/CSV exclude metadata/token/password/session", async () => {
            const csv = await adminExport(masterJar, `guard=${markC}&scope=GLOBAL`);
            const list = await adminList(`guard=${markC}&size=50`);
            for (const banned of ["metadata", "throttleKey", "tokenHash", "passwordHash", "lastEmittedAt", "cookie"]) {
              assert(!csv.text.includes(banned), `CSV must not contain ${banned}`);
              assert(!list.text.includes(banned), `list must not contain ${banned}`);
            }
          });

          await check("c10-3 export over limit → 422 (limit 5, markC has 6)", async () => {
            const r = await adminExport(masterJar, `guard=${markC}`, 422);
            assert(r.json?.error?.code === "SECURITY_AUDIT_EXPORT_LIMIT_EXCEEDED", "limit-exceeded code");
          });

          await check("c10-3 empty export → header-only CSV 200", async () => {
            const r = await adminExport(masterJar, `guard=nonexistent-${RUN_ID}`);
            const lines = r.text.replace(/^﻿/, "").split("\r\n").filter(Boolean);
            assert(lines.length === 1 && lines[0].includes("발생 시각"), "header-only CSV");
          });

          // D. UI helpers (pure)
          await check("c10-3 UI helpers: card toggle / scope chips / preset UTC / export label", async () => {
            assert(JSON.stringify(toggleAdminEventTypePatch("ALL", "USER_SOFT_DELETED")) === JSON.stringify({ adminAuditType: "USER_SOFT_DELETED", adminAuditPage: null }), "ALL→type");
            assert(JSON.stringify(toggleAdminEventTypePatch("USER_SOFT_DELETED", "USER_SOFT_DELETED")) === JSON.stringify({ adminAuditType: null, adminAuditPage: null }), "same→ALL");
            assert(toggleAdminEventTypePatch("ALL", "ALL") === null, "ALL re-click no-op");
            const NOW = new Date("2026-06-15T00:00:00.000Z");
            assert(JSON.stringify(adminPresetPatch("7d", NOW)) === JSON.stringify({ adminAuditFrom: "2026-06-09", adminAuditTo: "2026-06-15", adminAuditPage: null }), "7d preset UTC");
            assert(adminActivePreset("2026-06-09", "2026-06-15", NOW) === "7d", "activePreset 7d");
            const chips = buildAdminActiveChips({ eventType: "USER_SOFT_DELETED", scope: "GLOBAL", from: "", to: "", user: "", guard: "", sort: "newest", size: 20 }, ADMIN_LABELS, SCOPE_LABELS);
            const byKey = Object.fromEntries(chips.map((c) => [c.key, c]));
            assert(chips.length === 2 && byKey.eventType.label === "계정 탈퇴" && byKey.scope.label === "Global 이벤트", "eventType + scope chips");
            assert(JSON.stringify(Object.keys(byKey.scope.removePatch).sort()) === JSON.stringify(["adminAuditPage", "adminAuditScope"]), "scope removePatch isolated");
            assert(adminExportButtonLabel(3, false) === "CSV 내보내기 (3건)" && adminExportButtonLabel(0, false) === "CSV 내보내기 (0건)", "export label");
          });
        } finally {
          await prisma.securityAuditEvent.deleteMany({ where: { id: { in: createdEventIds } } });
          if (delMasterAdminEmail) {
            await prisma.masterAdmin.deleteMany({ where: { email: delMasterAdminEmail } });
          }
          for (const id of createdUserIds) {
            await prisma.user.delete({ where: { id } }).catch(() => {});
          }
        }
      }

      // c10-5: MasterAdmin step-up 재인증
      {
        const FWD = { "x-forwarded-for": "198.51.100.94" };
        const FWD_RL = { "x-forwarded-for": "198.51.100.95" };
        const seedHash = (
          await prisma.user.findUnique({ where: { email: accounts.admin }, select: { passwordHash: true } })
        )?.passwordHash;
        const masterUserId = (
          await prisma.user.findUnique({ where: { email: "master@testflow.local" }, select: { id: true } })
        )?.id;
        const createdUserIds = [];
        let delMasterAdminEmail = null;

        async function c105Login(email) {
          const jar = new CookieJar();
          await request("/api/auth/login", { method: "POST", headers: FWD, body: { email, password: PASSWORD }, jar, expectedStatus: 200 });
          assert(jar.cookies.has("tf_session"), `${email} login failed`);
          return jar;
        }
        async function createSessionFor(userId) {
          const rawToken = `c105tok-${RUN_ID}-${Math.floor(Math.random() * 1e9)}`;
          const tokenHash = createHash("sha256").update(rawToken).digest("hex");
          await prisma.session.create({ data: { userId, tokenHash, expiresAt: new Date(Date.now() + 86_400_000), lastSeenAt: new Date() } });
          const jar = new CookieJar();
          jar.cookies.set("tf_session", rawToken);
          return jar;
        }
        async function sessionIdFromJar(jar) {
          const raw = jar.cookies.get("tf_session");
          const hash = createHash("sha256").update(raw).digest("hex");
          return (await prisma.session.findUnique({ where: { tokenHash: hash }, select: { id: true } }))?.id;
        }
        async function elevate(jar, fwd = FWD) {
          await request("/api/admin/reauth", { method: "POST", jar, headers: fwd, body: { password: PASSWORD }, expectedStatus: 200 });
        }
        const PROTECTED = ["/api/admin/accounts/deleted", "/api/admin/security-audit", "/api/admin/security-audit/export"];

        try {
          // soft-deleted 복구 대상 + soft-deleted MasterAdmin
          const delTarget = await prisma.user.create({
            data: { email: `reauth-target.${RUN_ID}@x.local`, name: "재인증대상", passwordHash: seedHash, deletedAt: new Date(), deletedByUserId: leadUser.id, deletionReason: "SELF_WITHDRAWAL" },
          });
          createdUserIds.push(delTarget.id);
          const delMasterEmail = `delmaster-reauth.${RUN_ID}@x.local`;
          delMasterAdminEmail = delMasterEmail;
          const dm = await prisma.user.create({
            data: { email: delMasterEmail, name: "탈퇴마스터", passwordHash: seedHash, deletedAt: new Date(), deletedByUserId: leadUser.id, deletionReason: "SELF_WITHDRAWAL" },
          });
          createdUserIds.push(dm.id);
          await prisma.masterAdmin.create({ data: { email: delMasterEmail, name: "탈퇴마스터", passwordHash: seedHash } });

          await check("c10-5 guard priority: unauth 401 / CO·member 403 / deleted-master 403 / no-elevation 403", async () => {
            const masterJar = await c105Login("master@testflow.local");
            for (const p of PROTECTED) {
              assert((await request(p, { expectedStatus: 401 })).json?.error?.code === "AUTH_UNAUTHORIZED", `unauth ${p}`);
              assert((await request(p, { jar: adminJar, expectedStatus: 403 })).json?.error?.code === "AUTH_FORBIDDEN", `CO ${p}`);
              assert((await request(p, { jar: memberJar, expectedStatus: 403 })).json?.error?.code === "AUTH_FORBIDDEN", `member ${p}`);
              assert((await request(p, { jar: masterJar, expectedStatus: 403 })).json?.error?.code === "ADMIN_REAUTH_REQUIRED", `no-elev ${p}`);
            }
            const restorePath = `/api/admin/accounts/${delTarget.id}/restore`;
            assert((await request(restorePath, { method: "POST", expectedStatus: 401 })).json?.error?.code === "AUTH_UNAUTHORIZED", "unauth restore");
            assert((await request(restorePath, { method: "POST", jar: adminJar, expectedStatus: 403 })).json?.error?.code === "AUTH_FORBIDDEN", "CO restore");
            assert((await request(restorePath, { method: "POST", jar: masterJar, expectedStatus: 403 })).json?.error?.code === "ADMIN_REAUTH_REQUIRED", "no-elev restore");
            // soft-deleted MasterAdmin → USER_ACCOUNT_DELETED 우선
            const staleJar = await createSessionFor(dm.id);
            assert((await request("/api/admin/security-audit", { jar: staleJar, expectedStatus: 403 })).json?.error?.code === "USER_ACCOUNT_DELETED", "deleted master USER_ACCOUNT_DELETED precedes reauth");
          });

          await check("c10-5 status + reauth API (no-pw 400 / wrong 401 / correct 200); session timestamp", async () => {
            const jar = await c105Login("master@testflow.local");
            const sid = await sessionIdFromJar(jar);
            assert((await prisma.session.findUnique({ where: { id: sid }, select: { adminReauthenticatedAt: true } }))?.adminReauthenticatedAt === null, "fresh session not elevated (migration default null)");
            assert((await request("/api/admin/reauth/status", { jar, expectedStatus: 200 })).json.data.elevated === false, "status initial elevated=false");
            assert((await request("/api/admin/reauth", { method: "POST", jar, headers: FWD, body: {}, expectedStatus: 400 })).json?.error?.code === "ADMIN_REAUTH_PASSWORD_REQUIRED", "no password 400");
            assert((await request("/api/admin/reauth", { method: "POST", jar, headers: FWD, body: { password: "definitely-wrong-1!" }, expectedStatus: 401 })).json?.error?.code === "ADMIN_REAUTH_FAILED", "wrong password 401");
            const ok = await request("/api/admin/reauth", { method: "POST", jar, headers: FWD, body: { password: PASSWORD }, expectedStatus: 200 });
            assert(ok.json.data.ok === true && typeof ok.json.data.expiresAt === "string", "correct → ok + expiresAt");
            assert((await request("/api/admin/reauth/status", { jar, expectedStatus: 200 })).json.data.elevated === true, "status elevated=true after reauth");
            assert((await prisma.session.findUnique({ where: { id: sid }, select: { adminReauthenticatedAt: true } }))?.adminReauthenticatedAt instanceof Date, "current session timestamp set");
          });

          await check("c10-5 reauth has no side effects (no new session/cookie/role/member/audit change)", async () => {
            const jar = await c105Login("master@testflow.local");
            const cookieBefore = jar.cookies.get("tf_session");
            const beforeSessions = await prisma.session.count({ where: { userId: masterUserId } });
            const beforeRoles = await prisma.userRole.count({ where: { userId: masterUserId } });
            const beforeMembers = await prisma.workspaceMember.count({ where: { userId: masterUserId } });
            const beforeEvents = await prisma.securityAuditEvent.count();
            await request("/api/admin/reauth", { method: "POST", jar, headers: FWD, body: { password: PASSWORD }, expectedStatus: 200 });
            assert((await prisma.session.count({ where: { userId: masterUserId } })) === beforeSessions, "no new session");
            assert(jar.cookies.get("tf_session") === cookieBefore, "cookie unchanged");
            assert((await prisma.userRole.count({ where: { userId: masterUserId } })) === beforeRoles, "UserRole unchanged");
            assert((await prisma.workspaceMember.count({ where: { userId: masterUserId } })) === beforeMembers, "WorkspaceMember unchanged");
            assert((await prisma.securityAuditEvent.count()) === beforeEvents, "no SecurityAuditEvent created");
          });

          await check("c10-5 elevation is per-session; reauth after = success; expiry → ADMIN_REAUTH_REQUIRED (restore not executed)", async () => {
            const jarA = await c105Login("master@testflow.local");
            const jarB = await c105Login("master@testflow.local");
            const sidA = await sessionIdFromJar(jarA);
            const sidB = await sessionIdFromJar(jarB);
            await elevate(jarA);
            // A elevated → all protected succeed
            await request("/api/admin/accounts/deleted", { jar: jarA, expectedStatus: 200 });
            await request("/api/admin/security-audit", { jar: jarA, expectedStatus: 200 });
            await request("/api/admin/security-audit/export", { jar: jarA, expectedStatus: 200 });
            // B not elevated (elevation didn't propagate)
            assert((await request("/api/admin/security-audit", { jar: jarB, expectedStatus: 403 })).json?.error?.code === "ADMIN_REAUTH_REQUIRED", "session B still requires reauth");
            assert((await prisma.session.findUnique({ where: { id: sidB }, select: { adminReauthenticatedAt: true } }))?.adminReauthenticatedAt === null, "session B timestamp untouched");
            // expiry: A 의 timestamp 를 TTL 밖으로 → 만료
            await prisma.session.update({ where: { id: sidA }, data: { adminReauthenticatedAt: new Date(Date.now() - 20 * 60 * 1000) } });
            assert((await request("/api/admin/security-audit", { jar: jarA, expectedStatus: 403 })).json?.error?.code === "ADMIN_REAUTH_REQUIRED", "expired elevation → reauth required");
            // 만료 상태에서 restore 미실행
            const tgtBefore = await prisma.user.findUnique({ where: { id: delTarget.id }, select: { deletedAt: true } });
            const evBefore = await prisma.securityAuditEvent.count({ where: { eventType: "USER_RESTORED", targetUserId: delTarget.id } });
            assert((await request(`/api/admin/accounts/${delTarget.id}/restore`, { method: "POST", jar: jarA, expectedStatus: 403 })).json?.error?.code === "ADMIN_REAUTH_REQUIRED", "expired restore blocked");
            assert((await prisma.user.findUnique({ where: { id: delTarget.id }, select: { deletedAt: true } }))?.deletedAt?.getTime() === tgtBefore.deletedAt?.getTime(), "restore target deletedAt unchanged");
            assert((await prisma.securityAuditEvent.count({ where: { eventType: "USER_RESTORED", targetUserId: delTarget.id } })) === evBefore, "no USER_RESTORED on expired reauth");
            // logout 시 elevation 도 사라짐(세션 삭제)
            await elevate(jarB);
            await request("/api/auth/logout", { method: "POST", jar: jarB, expectedStatus: 200 });
            assert((await request("/api/admin/security-audit", { jar: jarB, expectedStatus: 401 })).json?.error?.code === "AUTH_UNAUTHORIZED", "logout removes session + elevation");
          });

          await check("c10-5 after elevation, all protected admin APIs succeed (existing contracts)", async () => {
            const jar = await c105Login("master@testflow.local");
            await elevate(jar);
            await request("/api/admin/accounts/deleted", { jar, expectedStatus: 200 });
            await request("/api/admin/security-audit", { jar, expectedStatus: 200 });
            await request("/api/admin/security-audit/export", { jar, expectedStatus: 200 });
            const t2 = await prisma.user.create({
              data: { email: `reauth-restore.${RUN_ID}@x.local`, name: "복구대상", passwordHash: seedHash, deletedAt: new Date(), deletedByUserId: leadUser.id, deletionReason: "SELF_WITHDRAWAL" },
            });
            createdUserIds.push(t2.id);
            const rr = await request(`/api/admin/accounts/${t2.id}/restore`, { method: "POST", jar, headers: FWD, expectedStatus: 200 });
            assert(rr.json?.data?.ok === true, "restore succeeds after elevation");
          });

          await check("c10-5 reauth failure rate limit (isolated IP); other IP bucket unaffected", async () => {
            const jar = await c105Login("master@testflow.local");
            let got429 = false;
            const statuses = [];
            for (let i = 0; i < 6; i += 1) {
              const r = await request("/api/admin/reauth", { method: "POST", jar, headers: FWD_RL, body: { password: `wrong-${i}` } });
              statuses.push(r.status);
              if (r.status === 429) got429 = true;
            }
            assert(got429, `expected 429 after repeated failures; got ${statuses.join(",")}`);
            // 다른 IP bucket 은 영향 없음 → 정상 비밀번호 200
            const jar2 = await c105Login("master@testflow.local");
            const ok = await request("/api/admin/reauth", { method: "POST", jar: jar2, headers: { "x-forwarded-for": "198.51.100.96" }, body: { password: PASSWORD }, expectedStatus: 200 });
            assert(ok.json?.data?.ok === true, "different IP bucket unaffected");
          });
        } finally {
          await prisma.rateLimitBucket.deleteMany({ where: { scope: "admin:reauth:fail" } });
          if (masterUserId) {
            await prisma.session.deleteMany({ where: { userId: masterUserId } });
          }
          if (delMasterAdminEmail) {
            await prisma.masterAdmin.deleteMany({ where: { email: delMasterAdminEmail } });
          }
          for (const id of createdUserIds) {
            await prisma.user.delete({ where: { id } }).catch(() => {});
          }
        }
      }

      await check("CO can sync WORKSPACE role to another user", async () => {
        const original = await prisma.userRole.findUnique({
          where: {
            userId_scopeType_scopeId: {
              userId: backendUser.id,
              scopeType: "WORKSPACE",
              scopeId: workspaceId,
            },
          },
          select: { role: true },
        });

        try {
          const result = await request(syncPath, {
            method: "POST",
            jar: adminJar,
            body: {
              roles: [{ scopeType: "WORKSPACE", scopeId: workspaceId, role: "VIEWER" }],
            },
            expectedStatus: 200,
          });
          const roles = result.json?.data?.roles ?? [];
          assert(
            roles.some(
              (r) =>
                r.scopeType === "WORKSPACE" && r.scopeId === workspaceId && r.role === "VIEWER",
            ),
            "sync did not set WORKSPACE VIEWER",
          );

          const persisted = await prisma.userRole.findUnique({
            where: {
              userId_scopeType_scopeId: {
                userId: backendUser.id,
                scopeType: "WORKSPACE",
                scopeId: workspaceId,
              },
            },
            select: { role: true },
          });
          assert(persisted?.role === "VIEWER", "WORKSPACE role not persisted as VIEWER");
        } finally {
          // 복원: backend 의 WORKSPACE Role 을 원래 값(MEMBER)으로 되돌림
          await prisma.userRole.upsert({
            where: {
              userId_scopeType_scopeId: {
                userId: backendUser.id,
                scopeType: "WORKSPACE",
                scopeId: workspaceId,
              },
            },
            update: { role: original?.role ?? "MEMBER" },
            create: {
              userId: backendUser.id,
              scopeType: "WORKSPACE",
              scopeId: workspaceId,
              role: original?.role ?? "MEMBER",
            },
          });
        }
      });

      await check("sync rejects scope-role violation with 400 USER_INVALID_ROLE_SCOPE", async () => {
        const result = await request(syncPath, {
          method: "POST",
          jar: adminJar,
          body: { roles: [{ scopeType: "WORKSPACE", scopeId: workspaceId, role: "CO" }] },
          expectedStatus: 400,
        });
        assert(
          result.json?.error?.code === "USER_INVALID_ROLE_SCOPE",
          "expected USER_INVALID_ROLE_SCOPE",
        );
      });

      await check("sync rejects scope outside company with 400 USER_SCOPE_NOT_IN_COMPANY", async () => {
        const result = await request(syncPath, {
          method: "POST",
          jar: adminJar,
          body: {
            roles: [{ scopeType: "WORKSPACE", scopeId: "ws_not_in_company", role: "MEMBER" }],
          },
          expectedStatus: 400,
        });
        assert(
          result.json?.error?.code === "USER_SCOPE_NOT_IN_COMPANY",
          "expected USER_SCOPE_NOT_IN_COMPANY",
        );
      });

      await check("non-CO cannot call sync (403)", async () => {
        const result = await request(syncPath, {
          method: "POST",
          jar: memberJar,
          body: { roles: [] },
          expectedStatus: 403,
        });
        assert(result.json?.error?.code === "AUTH_FORBIDDEN", "expected AUTH_FORBIDDEN");
      });

      await check("CO cannot revoke own last CO role (protected)", async () => {
        const result = await request(`/api/company/users/${leadUser.id}/roles/sync`, {
          method: "POST",
          jar: adminJar,
          // COMPANY/CO 를 제외 → 본인(=마지막) CO 회수 시도
          body: {
            roles: [{ scopeType: "WORKSPACE", scopeId: workspaceId, role: "WO" }],
          },
          expectedStatus: 400,
        });
        assert(
          ["USER_SELF_CO_REVOKE_FORBIDDEN", "USER_LAST_CO_FORBIDDEN"].includes(
            result.json?.error?.code,
          ),
          `expected CO revoke protection, got ${result.json?.error?.code}`,
        );

        // 보호가 동작했으므로 qa.lead 의 COMPANY/CO 가 그대로 유지되는지 확인
        const stillCo = await prisma.userRole.findUnique({
          where: {
            userId_scopeType_scopeId: {
              userId: leadUser.id,
              scopeType: "COMPANY",
              scopeId: companyId,
            },
          },
          select: { role: true },
        });
        assert(stillCo?.role === "CO", "qa.lead CO role must remain after blocked revoke");
      });

      // c6-2: 마지막 WO 보호 — qa.lead 는 유일한 WO. COMPANY/CO 는 유지(자가 CO 회수 회피)하고
      // WORKSPACE/WO 만 빼면 USER_LAST_WO_FORBIDDEN 으로 차단되어야 한다.
      await check("sync blocks removing the last WO (USER_LAST_WO_FORBIDDEN)", async () => {
        const result = await request(`/api/company/users/${leadUser.id}/roles/sync`, {
          method: "POST",
          jar: adminJar,
          body: { roles: [{ scopeType: "COMPANY", scopeId: companyId, role: "CO" }] },
          expectedStatus: 400,
        });
        assert(
          result.json?.error?.code === "USER_LAST_WO_FORBIDDEN",
          `expected USER_LAST_WO_FORBIDDEN, got ${result.json?.error?.code}`,
        );

        const stillWo = await prisma.userRole.findUnique({
          where: {
            userId_scopeType_scopeId: {
              userId: leadUser.id,
              scopeType: "WORKSPACE",
              scopeId: workspaceId,
            },
          },
          select: { role: true },
        });
        assert(stillWo?.role === "WO", "qa.lead WO must remain after blocked revoke");
      });

      const demoProject = await prisma.project.findFirst({
        where: { slug: "demo-project" },
        select: { id: true },
      });
      const demoProjectId = demoProject.id;
      const backendProjectKey = {
        userId: backendUser.id,
        scopeType: "PROJECT",
        scopeId: demoProjectId,
      };

      // c6-2: 마지막 PO 보호 — backend 를 demo-project 의 유일한 PO 로 만든 뒤,
      // sync 에서 그 PO 를 빼면 USER_LAST_PO_FORBIDDEN 으로 차단되어야 한다.
      await check("sync blocks removing the last PO (USER_LAST_PO_FORBIDDEN)", async () => {
        await prisma.userRole.create({ data: { ...backendProjectKey, role: "PO" } });

        try {
          const result = await request(syncPath, {
            method: "POST",
            jar: adminJar,
            body: { roles: [{ scopeType: "WORKSPACE", scopeId: workspaceId, role: "MEMBER" }] },
            expectedStatus: 400,
          });
          assert(
            result.json?.error?.code === "USER_LAST_PO_FORBIDDEN",
            `expected USER_LAST_PO_FORBIDDEN, got ${result.json?.error?.code}`,
          );
        } finally {
          await prisma.userRole.deleteMany({ where: backendProjectKey });
        }
      });

      // c6-2: PROJECT scope 우선권 — backend(워크스페이스 MEMBER) 에게 demo-project PO 를 부여하면
      // resolveProjectAuthRole 이 workspace fallback(Member) 보다 PROJECT PO(Admin) 를 우선하여
      // 프로젝트 자산 삭제(Admin 전용) 가 가능해진다.
      await check("PROJECT scope PO overrides workspace fallback (Admin-level on project)", async () => {
        // 삭제 대상 TC 를 admin 으로 생성
        const created = await request("/api/projects/demo-project/test-cases", {
          method: "POST",
          jar: adminJar,
          body: {
            title: `c6-2 PO precedence TC ${RUN_ID}`,
            folderId: "payment-checkout",
            priority: "medium",
            status: "ready",
            steps: ["Open", "Submit"],
            expectedResult: "ok",
          },
          expectedStatus: 201,
        });
        const tcId = created.json?.data?.id;
        assert(tcId, "failed to create test case for PO precedence test");
        cleanup.testCases.push(tcId);

        await prisma.userRole.create({ data: { ...backendProjectKey, role: "PO" } });

        try {
          // backend(memberJar) 는 워크스페이스 MEMBER 라 평소 TC 삭제가 403 이지만,
          // demo-project PROJECT/PO 부여로 해당 프로젝트에서 Admin 급 → 삭제 200.
          await request(`/api/projects/demo-project/test-cases/${tcId}`, {
            method: "DELETE",
            jar: memberJar,
            expectedStatus: 200,
          });
        } finally {
          await prisma.userRole.deleteMany({ where: backendProjectKey });
        }
      });

      // c9-1: Company 단위 사용자 비활성/활성 + 접근 차단
      {
        const backendCoKey = {
          userId_scopeType_scopeId: {
            userId: backendUser.id,
            scopeType: "COMPANY",
            scopeId: companyId,
          },
        };
        let tempUserId = null;
        let tempCompanyId = null;
        let tempWorkspaceId = null;

        async function setBackendState(status) {
          await prisma.companyUserState.upsert({
            where: { companyId_userId: { companyId, userId: backendUser.id } },
            update: { status },
            create: { companyId, userId: backendUser.id, status },
          });
        }

        try {
          await check("seed company users have ACTIVE CompanyUserState", async () => {
            const states = await prisma.companyUserState.findMany({
              where: {
                companyId,
                userId: { in: [leadUser.id, backendUser.id, pmUser.id] },
              },
              select: { userId: true, status: true },
            });
            assert(states.length >= 3, "expected seed states for lead/backend/pm");
            assert(
              states.every((s) => s.status === "ACTIVE"),
              "seed users should be ACTIVE",
            );
          });

          await check("CO deactivate member blocks company workspace/project APIs; reactivate restores", async () => {
            const result = await request(`/api/company/users/${backendUser.id}/deactivate`, {
              method: "POST",
              jar: adminJar,
              expectedStatus: 200,
            });
            assert(result.json?.data?.status === "INACTIVE", "deactivate should return INACTIVE");

            const state = await prisma.companyUserState.findUnique({
              where: { companyId_userId: { companyId, userId: backendUser.id } },
            });
            assert(state?.status === "INACTIVE", "DB state should be INACTIVE");
            assert(state?.deactivatedAt, "deactivatedAt should be set");

            // UserRole / WorkspaceMember 는 삭제되지 않아야 한다.
            const role = await prisma.userRole.findUnique({
              where: {
                userId_scopeType_scopeId: {
                  userId: backendUser.id,
                  scopeType: "WORKSPACE",
                  scopeId: workspaceId,
                },
              },
            });
            assert(role, "WORKSPACE UserRole must be preserved while INACTIVE");
            const member = await prisma.workspaceMember.findUnique({
              where: { workspaceId_userId: { workspaceId, userId: backendUser.id } },
            });
            assert(member, "WorkspaceMember must be preserved while INACTIVE");

            // 비활성 사용자(backend) 는 해당 Company workspace/project API 차단.
            const projects = await request("/api/projects", { jar: memberJar, expectedStatus: 403 });
            assert(projects.json?.error?.code === "USER_INACTIVE", "projects should be USER_INACTIVE");
            const dash = await request("/api/dashboard/summary", { jar: memberJar, expectedStatus: 403 });
            assert(dash.json?.error?.code === "USER_INACTIVE", "dashboard should be USER_INACTIVE");

            // 재활성화 → 접근 복구.
            const reactivate = await request(`/api/company/users/${backendUser.id}/activate`, {
              method: "POST",
              jar: adminJar,
              expectedStatus: 200,
            });
            assert(reactivate.json?.data?.status === "ACTIVE", "activate should return ACTIVE");
            await request("/api/projects", { jar: memberJar, expectedStatus: 200 });
          });

          await check("deactivated CO is blocked from company API with USER_INACTIVE", async () => {
            // backend 를 2번째 CO 로 승격 후 비활성화 → backend 는 CO 지만 INACTIVE.
            await prisma.userRole.upsert({
              where: backendCoKey,
              update: { role: "CO" },
              create: { userId: backendUser.id, scopeType: "COMPANY", scopeId: companyId, role: "CO" },
            });
            await request(`/api/company/users/${backendUser.id}/deactivate`, {
              method: "POST",
              jar: adminJar,
              expectedStatus: 200,
            });
            const result = await request("/api/company/users", { jar: memberJar, expectedStatus: 403 });
            assert(result.json?.error?.code === "USER_INACTIVE", "company API should be USER_INACTIVE");

            // 재활성화(backend 는 CO 인 채 ACTIVE) → 다음 self 테스트에 사용.
            await request(`/api/company/users/${backendUser.id}/activate`, {
              method: "POST",
              jar: adminJar,
              expectedStatus: 200,
            });
          });

          await check("non-last CO self-deactivate → USER_SELF_DEACTIVATE_FORBIDDEN", async () => {
            // backend 는 CO(active) 이고 qa.lead 도 CO 라 마지막이 아님 → 본인 비활성은 SELF.
            const result = await request(`/api/company/users/${backendUser.id}/deactivate`, {
              method: "POST",
              jar: memberJar,
              expectedStatus: 400,
            });
            assert(
              result.json?.error?.code === "USER_SELF_DEACTIVATE_FORBIDDEN",
              `expected USER_SELF_DEACTIVATE_FORBIDDEN, got ${result.json?.error?.code}`,
            );
            // backend CO 승격 해제(이후 qa.lead 가 유일 CO).
            await prisma.userRole.deleteMany({
              where: { userId: backendUser.id, scopeType: "COMPANY", scopeId: companyId, role: "CO" },
            });
          });

          await check("last active CO cannot be deactivated → USER_LAST_CO_DEACTIVATE_FORBIDDEN", async () => {
            const result = await request(`/api/company/users/${leadUser.id}/deactivate`, {
              method: "POST",
              jar: adminJar,
              expectedStatus: 400,
            });
            assert(
              result.json?.error?.code === "USER_LAST_CO_DEACTIVATE_FORBIDDEN",
              `expected USER_LAST_CO_DEACTIVATE_FORBIDDEN, got ${result.json?.error?.code}`,
            );
          });

          await check("non-CO cannot deactivate/activate (AUTH_FORBIDDEN)", async () => {
            const deact = await request(`/api/company/users/${pmUser.id}/deactivate`, {
              method: "POST",
              jar: memberJar,
              expectedStatus: 403,
            });
            assert(deact.json?.error?.code === "AUTH_FORBIDDEN", "deactivate should be AUTH_FORBIDDEN");
            const act = await request(`/api/company/users/${pmUser.id}/activate`, {
              method: "POST",
              jar: memberJar,
              expectedStatus: 403,
            });
            assert(act.json?.error?.code === "AUTH_FORBIDDEN", "activate should be AUTH_FORBIDDEN");
          });

          await check("deactivation is per-company; other Company stays ACTIVE", async () => {
            const tempCompany = await prisma.company.create({
              data: { name: `C9 Other ${RUN_ID}`, slug: `c9-other-${RUN_ID}` },
            });
            tempCompanyId = tempCompany.id;
            const tempWorkspace = await prisma.workspace.create({
              data: { name: `C9 WS ${RUN_ID}`, slug: `c9-ws-${RUN_ID}`, companyId: tempCompany.id },
            });
            tempWorkspaceId = tempWorkspace.id;
            const tempUser = await prisma.user.create({
              data: { email: `c9.multi.${RUN_ID}@state.local`, name: "C9 Multi", passwordHash: "x" },
            });
            tempUserId = tempUser.id;

            // demo company 소속(상태/멤버십) + temp company 소속(상태).
            await prisma.workspaceMember.create({
              data: { workspaceId, userId: tempUser.id, role: "MEMBER", status: "ACTIVE" },
            });
            await prisma.companyUserState.create({
              data: { companyId, userId: tempUser.id, status: "ACTIVE" },
            });
            await prisma.companyUserState.create({
              data: { companyId: tempCompany.id, userId: tempUser.id, status: "ACTIVE" },
            });

            // demo 에서 비활성화.
            await request(`/api/company/users/${tempUser.id}/deactivate`, {
              method: "POST",
              jar: adminJar,
              expectedStatus: 200,
            });

            const demoState = await prisma.companyUserState.findUnique({
              where: { companyId_userId: { companyId, userId: tempUser.id } },
            });
            const otherState = await prisma.companyUserState.findUnique({
              where: { companyId_userId: { companyId: tempCompany.id, userId: tempUser.id } },
            });
            assert(demoState?.status === "INACTIVE", "demo state should be INACTIVE");
            assert(otherState?.status === "ACTIVE", "other company state must stay ACTIVE");
          });
        } finally {
          // backend 를 ACTIVE 로 복구하고 CO 승격 해제(이후 다른 테스트 영향 방지).
          await prisma.userRole.deleteMany({
            where: { userId: backendUser.id, scopeType: "COMPANY", scopeId: companyId, role: "CO" },
          });
          await setBackendState("ACTIVE");

          if (tempUserId) {
            await prisma.companyUserState.deleteMany({ where: { userId: tempUserId } });
            await prisma.workspaceMember.deleteMany({ where: { userId: tempUserId } });
            await prisma.userRole.deleteMany({ where: { userId: tempUserId } });
            await prisma.session.deleteMany({ where: { userId: tempUserId } });
            await prisma.user.delete({ where: { id: tempUserId } }).catch(() => {});
          }
          if (tempWorkspaceId) {
            await prisma.workspace.delete({ where: { id: tempWorkspaceId } }).catch(() => {});
          }
          if (tempCompanyId) {
            await prisma.company.delete({ where: { id: tempCompanyId } }).catch(() => {});
          }
        }
      }
    }

    await cleanupCreatedData(adminJar, cleanup);

    await check("logout invalidates current session", async () => {
      await request("/api/auth/logout", {
        method: "POST",
        jar: adminJar,
        expectedStatus: 200,
      });
      await request("/api/auth/me", {
        jar: adminJar,
        expectedStatus: 401,
      });
    });

    await check("logged out page request redirects again", async () => {
      const result = await request("/dashboard", {
        jar: adminJar,
        redirect: "manual",
        expectedStatus: 307,
      });
      const location = result.response.headers.get("location") ?? "";
      assert(
        location.includes("/login?next=%2Fdashboard"),
        `Unexpected redirect location after logout: ${location}`,
      );
    });

    console.log("Auth smoke test completed successfully.");
  } catch (error) {
    if (adminJar) {
      await cleanupCreatedData(adminJar, cleanup).catch(() => {});
    }
    throw error;
  } finally {
    await disconnectPrisma();
    await stopServer();
  }
}

async function cleanupCreatedData(adminJar, cleanup) {
  for (const defectId of cleanup.defects.splice(0).reverse()) {
    await request(`/api/projects/demo-project/defects/${defectId}`, {
      method: "DELETE",
      jar: adminJar,
    }).catch(() => {});
  }

  for (const runId of cleanup.runs.splice(0).reverse()) {
    await request(`/api/projects/demo-project/runs/${runId}`, {
      method: "DELETE",
      jar: adminJar,
    }).catch(() => {});
  }

  for (const testCaseId of cleanup.testCases.splice(0).reverse()) {
    await request(`/api/projects/demo-project/test-cases/${testCaseId}`, {
      method: "DELETE",
      jar: adminJar,
    }).catch(() => {});
  }

  for (const projectId of cleanup.projects.splice(0).reverse()) {
    await request(`/api/projects/${projectId}`, {
      method: "DELETE",
      jar: adminJar,
    }).catch(() => {});
  }
}

main().catch(async (error) => {
  await stopServer();
  console.error(error);
  process.exit(1);
});
