import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = { title: "Notion GitHub Coding Agent", description: "Human-reviewed AI engineering workflow" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant"><body><div className="shell">
    <aside className="sidebar"><div className="brand">Coding Agent<small>Notion × GitHub</small></div><nav className="nav">
      <Link href="/">Overview</Link><Link href="/inbox">GitHub Inbox</Link><Link href="/tasks">Tasks</Link><Link href="/runs">Agent Runs</Link><Link href="/settings">Settings</Link>
    </nav></aside><main className="main">{children}</main>
  </div></body></html>;
}
