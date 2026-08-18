"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const groups = [
  { label: "工作區", links: [["/", "今日總覽", "⌂"], ["/inbox", "GitHub 收件匣", "↙"], ["/tasks", "任務", "□"]] },
  { label: "AI Agent", links: [["/runs", "執行紀錄", "◇"], ["/evaluations", "模型評估", "◎"]] },
  { label: "系統", links: [["/sync", "同步紀錄", "↻"], ["/settings", "設定", "⚙"]] },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <div className="shell">
    <aside className="sidebar">
      <Link href="/" className="brand"><span className="brand-mark">NG</span><span>Notion GitHub<small>AI 工程工作台</small></span></Link>
      <nav className="nav" aria-label="主要導覽">
        {groups.map(group => <div className="nav-group" key={group.label}><span className="nav-label">{group.label}</span>{group.links.map(([href, label, icon]) => { const active = href === "/" ? pathname === "/" : pathname.startsWith(href); return <Link href={href} className={active ? "active" : ""} aria-current={active ? "page" : undefined} key={href}><span className="nav-icon" aria-hidden="true">{icon}</span>{label}</Link>; })}</div>)}
        <div className="nav-group"><span className="nav-label">展示</span><Link href="/demo" className={pathname.startsWith("/demo") ? "active" : ""} aria-current={pathname.startsWith("/demo") ? "page" : undefined}><span className="nav-icon" aria-hidden="true">▶</span>面試 Demo</Link></div>
      </nav>
    </aside>
    <main className="main">{children}</main>
  </div>;
}
