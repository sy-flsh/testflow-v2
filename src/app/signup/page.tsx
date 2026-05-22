import { SignupForm } from "@/features/auth/signup-form";

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
        <SignupForm />
      </section>
    </main>
  );
}
