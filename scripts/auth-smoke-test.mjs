#!/usr/bin/env node

import "dotenv/config";
import { spawn } from "node:child_process";
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
