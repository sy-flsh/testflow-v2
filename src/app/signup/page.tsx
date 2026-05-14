import Link from "next/link";

export default function SignupPage() {
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
            QA, 개발, PM이 함께 쓰는 한국형 테스트 관리 도구
          </h1>
          <p className="mt-4 text-sm text-blue-100">
            테스트케이스 작성부터 실행 결과와 결함 연결까지 한 흐름으로
            관리합니다.
          </p>
        </div>
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-semibold">회원가입</h2>
            <Link
              href="/login"
              className="text-sm font-medium text-[var(--brand-primary)]"
            >
              로그인
            </Link>
          </div>
          <div className="space-y-4">
            <label className="block text-sm font-medium">
              이름
              <input
                className="mt-2 h-10 w-full rounded-md border border-[var(--border-default)] px-3 outline-none focus:border-[var(--brand-primary)]"
                placeholder="홍길동"
              />
            </label>
            <label className="block text-sm font-medium">
              아이디
              <input
                className="mt-2 h-10 w-full rounded-md border border-[var(--border-default)] px-3 outline-none focus:border-[var(--brand-primary)]"
                placeholder="영문/숫자 4~20자"
              />
            </label>
            <label className="block text-sm font-medium">
              비밀번호
              <input
                type="password"
                className="mt-2 h-10 w-full rounded-md border border-[var(--border-default)] px-3 outline-none focus:border-[var(--brand-primary)]"
                placeholder="8자 이상"
              />
            </label>
            <button className="h-10 w-full rounded-md bg-[var(--brand-primary)] text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)]">
              가입하기
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
