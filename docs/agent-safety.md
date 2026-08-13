# Agent safety

- External issue and Notion content is untrusted data, never instruction hierarchy.
- Baseline checks must pass before model invocation.
- The model returns structured analysis plus at most three complete replacements for existing files.
- Every patch proposal must cite an exact repository excerpt with a file and 1-based line range. The Worker verifies the quote against the Context actually sent to the model; an unverified or missing citation cannot reach approval.
- Repository Context uses commit-scoped hybrid retrieval: cached embeddings plus lexical signals. Retrieval failures degrade to the existing keyword selector and are recorded in the Run rather than blocking baseline checks.
- The vector index stores only repository identity, commit SHA, path, content hash, and embedding. Raw source excerpts remain in the local worktree and are not persisted to Supabase.
- The worker validates requested and actual changed paths, blocks sensitive locations, and reruns all configured checks.
- A stored diff requires explicit approval. A changed remote base invalidates approval.
- The worker cannot merge PRs, force-push, modify the default branch, install system packages, or access arbitrary repositories.
