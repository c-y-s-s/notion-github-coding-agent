# Architecture

```mermaid
flowchart LR
  N[Notion] -->|webhook| W[Next.js API]
  G[GitHub] -->|webhook| W
  W --> S[(Supabase)]
  D[Dashboard] --> W
  P[Local Python Worker] --> S
  P --> R[Local Git worktree]
  P -->|approved branch only| G
  W --> N
  W --> G
```

Supabase is the canonical identity and workflow store. Content authority remains source-based: Notion-origin requirements stay authoritative in Notion; GitHub-origin issue text stays authoritative in GitHub; GitHub owns engineering state; the worker owns agent state.

