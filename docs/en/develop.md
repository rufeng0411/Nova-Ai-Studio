# Develop

Config-level only.

```bash
cp .env.example .env
corepack enable
pnpm install
pnpm --dir ui run build
```

CI is Node + UI build, not Python unittest.

Product behavior changes go through the factory overlay, not edits in the commercial tree.
