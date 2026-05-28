#!/usr/bin/env node

import { spawn } from "node:child_process";

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

async function login(email, expectedRole) {
  const jar = new CookieJar();
  const result = await request("/api/auth/login", {
    method: "POST",
    body: { email, password: PASSWORD },
    jar,
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
      env: { ...process.env, PORT },
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
