import type { Metadata } from "next";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { AutoGitHubSync } from "@/components/auto-github-sync";
import "./globals.css";

export const metadata: Metadata = { title: "Notion GitHub 程式開發代理", description: "由人工審核的程式開發工作流程" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant" suppressHydrationWarning><body suppressHydrationWarning><div className="shell">
    <aside className="sidebar"><div className="brand">Notion GitHub<small>工程工作台</small></div><nav className="nav">
      <Link href="/">總覽</Link><Link href="/inbox">GitHub 收件匣</Link><Link href="/tasks">任務</Link><Link href="/runs">代理執行紀錄</Link><Link href="/sync">同步紀錄</Link><Link href="/settings">設定</Link><LogoutButton />
    </nav></aside><main className="main"><AutoGitHubSync />{children}</main>
  </div></body></html>;
}
