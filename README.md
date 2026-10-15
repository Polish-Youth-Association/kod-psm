# kod-psm

Code for the Polish Youth Association (PSM) staff portal.

- **Frontend:** `apps/psm-portal`, a Next.js static export hosted on **GitHub Pages**.
- **Backend:** `wix-velo/`, Wix Velo HTTP functions + **Wix CMS** for data.

---

## 📁 Repository Structure

```text
kod-psm/
│
├── apps/
│   └── psm-portal/          # Next.js staff portal (static export → GitHub Pages)
│
├── wix-velo/                # Version-controlled source for the Wix Velo backend
│   ├── backend/             # http-functions + backend modules
│   └── reference/           # Email/signature HTML + delegation codes kept from the retired services
│
├── .github/
│   └── workflows/
│       ├── pages.yaml       # Build + deploy psm-portal to GitHub Pages
│       └── security.yaml    # Report-only security scans
│
├── docs/                    # Developer documentation
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
└── README.md
```

The Cloud Run services that used to live in `apps/` (and the `libs/` they shared) have been
removed. Their behavior was ported to `wix-velo/backend/`; see `wix-velo/CUTOVER.md` and git history.

---

## 🧰 Tech Stack

- **TypeScript**, **Next.js 16**, **React 19**, **Tailwind CSS**
- **pnpm** workspaces
- **Wix Velo** (backend functions + Secrets Manager) and **Wix CMS** (data)
- **Google Workspace** APIs (account provisioning, Gmail) via a delegated service account
- **Google Sign-In** gates the portal and every backend call

---

## 🚀 CI/CD Workflows

One pipeline: **merge to `main` → auto-deploy.**

**pages.yaml** | Builds the `psm-portal` static export and publishes it to **GitHub Pages** on every push to `main`.
**security.yaml** | Report-only security scans (Gitleaks, pnpm audit, Semgrep, Trivy IaC, zizmor) on push to `main`.

The `wix-velo/` code is synced into the Wix site separately; it is not deployed by GitHub Actions.

---

## 🔀 Branch Strategy

- **main** → the only long-lived branch; merging to it deploys to GitHub Pages.
- Feature branches → daily development, PR'd into `main`.

---

## 🛠️ Local Development

Install dependencies:

```bash
pnpm install
pnpm --filter @kod-psm/psm-portal run dev
```
