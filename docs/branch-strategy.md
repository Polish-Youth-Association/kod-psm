# Branch Strategy

This repository uses a simple, scalable branching model designed to support:
- Safe development workflows
- Automatic CI checks
- Cloud Run deployments for dev and production
- Future review environments (ephemeral PR environments)

## Branch Structure

### `main` (Production)
- Contains the production-ready code.
- Protected by strict GitHub rules:
  - Pull request required
  - No direct pushes
  - CI must pass before merging
  - Force pushes blocked
  - Branch deletion restricted
- In the future, merges to `main` will trigger production deployment.

### `dev` (Non-Production)
- Used for integration testing and non-prod deployments.
- PRs to `dev` trigger the full CI pipeline.
- A Cloud Run non-prod service deploys from this branch.
- Lighter restrictions than `main` but still protected enough to ensure stability.

### Feature Branches
- Developers branch off from `dev` for new work.
- Naming example:
  - `feature/new-onboarding-flow`
  - `fix/service-auth-issue`
- Feature branches should always go through PR → `dev`.

## Typical Workflow

1. **Create feature branch**
2. **Develop & push changes**
3. **Open PR → dev**
   - CI (`CI Check / Install & Build`) runs automatically
4. **Merge into dev**
   - Deployment to Cloud Run (non-prod)
5. **When ready, open PR from dev → main**
   - CI runs again
   - Code review required
6. **Merge into main**
   - (Future) Production deploy

This model ensures production stability while enabling fast iteration and safe testing on dev.