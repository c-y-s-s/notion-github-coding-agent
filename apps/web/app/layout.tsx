import type { Metadata } from "next";
import { AutoGitHubSync } from "@/components/auto-github-sync";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = { title: "Notion GitHub 程式開發代理", description: "由人工審核的程式開發工作流程" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Translation extensions can decorate both root nodes before React hydrates.
  return <html lang="zh-Hant" suppressHydrationWarning><body suppressHydrationWarning><AppShell><AutoGitHubSync />{children}</AppShell></body></html>;
}
