import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen grid-cols-1 bg-white lg:grid-cols-2">
      <section className="flex min-h-72 items-center bg-[var(--brand-primary)] px-8 py-10 text-white lg:min-h-screen lg:px-14">
        <div className="max-w-lg">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-sm text-[var(--brand-primary)]">
              TF
            </span>
            TestFlow
          </div>
          <h1 className="mt-10 text-3xl font-semibold leading-tight tracking-normal">
            엑셀에서 바로 시작하는 한국형 테스트 관리 도구
          </h1>
          <p className="mt-4 text-sm text-blue-100">
            QA, 개발, PM이 함께 쓰는 협업형 테스트 관리 SaaS
          </p>
          <div className="mt-10 grid grid-cols-3 gap-3 text-sm">
            {["TC 관리", "실행 기록", "결함 연결"].map((item) => (
              <div
                key={item}
                className="rounded-md border border-white/20 bg-white/10 px-3 py-2"
              >
                {item}
              </div>
            ))}
          </div>
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
              <input
                className="mt-2 h-10 w-full rounded-md border border-[var(--border-default)] px-3 outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-primary)]"
                placeholder="아이디를 입력하세요"
              />
            </label>
            <label className="block text-sm font-medium">
              비밀번호
              <input
                type="password"
                className="mt-2 h-10 w-full rounded-md border border-[var(--border-default)] px-3 outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-primary)]"
                placeholder="비밀번호를 입력하세요"
              />
            </label>
            <button className="h-10 w-full rounded-md bg-[var(--brand-primary)] text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)]">
              로그인
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
