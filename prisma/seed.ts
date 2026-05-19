import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL 환경 변수가 필요합니다.");
}

const adapter = new PrismaPg(databaseUrl);
const prisma = new PrismaClient({ adapter });

const workspaceSeed = {
  name: "TestFlow QA",
  slug: "testflow-qa",
  description: "TestFlow v2 기본 워크스페이스",
};

const users = [
  { email: "qa.lead@testflow.local", name: "김QA", role: "ADMIN" as const },
  { email: "backend@testflow.local", name: "박개발", role: "MEMBER" as const },
  { email: "frontend@testflow.local", name: "이프론트", role: "MEMBER" as const },
  { email: "pm@testflow.local", name: "정PM", role: "VIEWER" as const },
];

const projects = [
  {
    name: "결제 시스템 v2",
    slug: "demo-project",
    description: "결제 모듈 개편",
    color: "#2563EB",
    status: "ACTIVE" as const,
  },
  {
    name: "회원가입 플로우",
    slug: "signup-flow",
    description: "신규 가입 개선",
    color: "#10B981",
    status: "ACTIVE" as const,
  },
  {
    name: "체크아웃 개선",
    slug: "checkout-improvement",
    description: "장바구니 UX",
    color: "#8B5CF6",
    status: "ACTIVE" as const,
  },
  {
    name: "모바일 앱 v3",
    slug: "mobile-app-v3",
    description: "iOS/Android 동시",
    color: "#F59E0B",
    status: "ACTIVE" as const,
  },
  {
    name: "알림 시스템",
    slug: "notification-system",
    description: "Push/SMS 통합",
    color: "#14B8A6",
    status: "COMPLETED" as const,
  },
];

async function main() {
  const workspace = await prisma.workspace.upsert({
    where: { slug: workspaceSeed.slug },
    update: workspaceSeed,
    create: workspaceSeed,
  });

  for (const userSeed of users) {
    const user = await prisma.user.upsert({
      where: { email: userSeed.email },
      update: { name: userSeed.name },
      create: {
        email: userSeed.email,
        name: userSeed.name,
      },
    });

    await prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: user.id,
        },
      },
      update: {
        role: userSeed.role,
        status: "ACTIVE",
      },
      create: {
        workspaceId: workspace.id,
        userId: user.id,
        role: userSeed.role,
        status: "ACTIVE",
      },
    });
  }

  for (const projectSeed of projects) {
    await prisma.project.upsert({
      where: {
        workspaceId_slug: {
          workspaceId: workspace.id,
          slug: projectSeed.slug,
        },
      },
      update: {
        name: projectSeed.name,
        description: projectSeed.description,
        color: projectSeed.color,
        status: projectSeed.status,
      },
      create: {
        workspaceId: workspace.id,
        ...projectSeed,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
