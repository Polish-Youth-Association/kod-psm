# Continuous Integration (CI)

This repo uses GitHub Actions for continuous integration.  
The primary workflow is `CI.yaml`, which performs:

- Workspace dependency installation
- TypeScript build validation
- pnpm monorepo builds

This ensures that no code merges into `dev` or `main` unless the entire monorepo builds successfully.

---

## CI Workflow Overview

### Trigger
```yaml
on:
  pull_request:
    branches:
      - dev
      - main