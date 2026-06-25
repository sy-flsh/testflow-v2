#!/usr/bin/env node

import "dotenv/config";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const PORT = process.env.TESTFLOW_TEST_PORT || "3210";
const BASE_URL = process.env.TESTFLOW_BASE_URL || `http://127.0.0.1:${PORT}`;
const BASE_ORIGIN = new URL(BASE_URL).origin;
const EXTERNAL_SERVER = process.env.TESTFLOW_EXTERNAL_SERVER === "1";
const PASSWORD = "password123!";
const RUN_ID = `${Date.now()}`;

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
