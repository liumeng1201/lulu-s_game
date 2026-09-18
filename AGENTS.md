# Repository-wide development rules

These rules apply to every file in this repository.

## Synchronize before editing

Before making **any code or documentation change**, synchronize the local `codex` branch with the remote `main` branch:

```bash
git status --short
git fetch origin --prune
git switch codex
git merge --ff-only origin/main
```

- Do not begin editing if the working tree is not clean.
- Do not skip this synchronization, even for a small follow-up change.
- If the fast-forward merge cannot be completed, resolve the branch state before modifying files; do not force-push or discard existing work.
