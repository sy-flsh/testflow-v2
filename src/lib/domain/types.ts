export type ProjectStatus = "active" | "completed" | "archived";
export type Priority = "high" | "medium" | "low";
export type TestCaseStatus = "ready" | "draft" | "deprecated";
export type RunStatus = "planned" | "in_progress" | "paused" | "completed";
export type ResultStatus = "pending" | "passed" | "failed" | "blocked" | "skipped";
export type DefectStatus = "open" | "in_progress" | "resolved" | "closed";
export type DefectSeverity = "critical" | "major" | "minor" | "trivial";
export type MemberRole = "Admin" | "Member" | "Viewer";

export type Project = {
  id: string;
  name: string;
  description: string;
  color: string;
  status: ProjectStatus;
  progress: number;
  testCaseCount: number;
  passCount: number;
  failCount: number;
  members: string[];
  updatedAtLabel: string;
  createdAtOrder: number;
};

export type TestFolder = {
  id: string;
  label: string;
  parentId?: string;
};

export type TestStep = {
  order: number;
  action: string;
  expectedResult?: string;
};

export type TestCase = {
  id: string;
  title: string;
  priority: Priority;
  status: TestCaseStatus;
  folderId: string;
  tags: string[];
  author: string;
  updatedAtLabel: string;
  description: string;
  preconditions: string;
  steps: string[];
  expectedResult: string;
};

export type TestRunResult = {
  id: string;
  testCase: TestCase;
  status: ResultStatus;
  actualResult: string;
  defectCount: number;
};

export type TestRun = {
  id: string;
  title: string;
  description: string;
  assignee: string;
  environment: string;
  startDate: string;
  dueDate: string;
  status: RunStatus;
  createdLabel: string;
  results: TestRunResult[];
};

export type Defect = {
  id: string;
  title: string;
  description: string;
  reproductionSteps: string;
  checklist: string[];
  severity: DefectSeverity;
  priority: Priority;
  status: DefectStatus;
  assignee: string;
  reporter: string;
  createdAt: string;
  updatedAt: string;
  linkedTestCaseId: string;
  linkedTestCaseTitle: string;
  linkedRunResultId?: string;
  attachmentCount: number;
};

export type User = {
  id: string;
  name: string;
  email: string;
};

export type Member = User & {
  role: MemberRole;
  status: "active" | "pending";
  lastActive: string;
};
