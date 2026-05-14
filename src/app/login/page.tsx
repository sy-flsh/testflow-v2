import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen grid-cols-1 bg-white md:grid-cols-2">
      <section className="flex items-center bg-[var(--brand-primary)] px-10 py-12 text-white">
        <div>
          <p className="text-lg font-semibold">TestFlow</p>
          <h1 className="mt-8 max-w-md text-3xl font-semibold leading-tight">
            엑셀에서 바로 시작하는 한국형 테스트 관리 도구
          </h1>
          <p className="mt-4 text-sm text-blue-100">
            QA, 개발, PM이 함께 쓰는 협업형 테스트 관리 SaaS
          </p>
        </div>
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-semibold">로그인</h2>
            <Link
              href="/signup"
              className="text-sm font-medium text-[var(--brand-primary)]"
            >
              회원가입
            </Link>
          </div>
          <div className="space-y-4">
            <label className="block text-sm font-medium">
              아이디
              <input className="mt-2 h-10 w-full rounded-md border border-[var(--border-default)] px-3" />
            </label>
            <label className="block text-sm font-medium">
              비밀번호
              <input
                type="password"
                className="mt-2 h-10 w-full rounded-md border border-[var(--border-default)] px-3"
              />
            </label>
            <button className="h-10 w-full rounded-md bg-[var(--brand-primary)] text-sm font-medium text-white">
              로그인
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
