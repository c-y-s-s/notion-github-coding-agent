import { LoginForm } from "@/components/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <main className="login-page">
    <section className="login-card">
      <div className="eyebrow">Private workspace</div>
      <h1>登入工程工作台</h1>
      <p className="lead">外部使用者仍可在 GitHub 提出 Issue；此處只供管理者審核及操作 Agent。</p>
      <LoginForm nextPath={safeNextPath(next)} />
    </section>
  </main>;
}

function safeNextPath(value?: string) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}
