"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const COOLDOWN_MS = 30_000;

export function AutoGitHubSync() {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const lastRun = Number(sessionStorage.getItem("github-reconcile-at") || 0);
    if (Date.now() - lastRun < COOLDOWN_MS) return;
    fetch("/api/github/reconcile", { method: "POST" }).then(response => {
      if (response.ok) {
        sessionStorage.setItem("github-reconcile-at", String(Date.now()));
        router.refresh();
      }
    }).catch(() => undefined);
  }, [router]);

  return null;
}
