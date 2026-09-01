# kod-psm

A monorepo for PSM, built around a clean domain-driven structure.  
Each domain contains its own applications, services, and deployment pipeline.  
Cloud Run + GitHub Actions power the deployment workflow, with automated review checks and branch protections.

---

## 📁 Monorepo Structure
### 📚 Repository Architecture Diagram

```text
kod-psm/
│
├── apps/                                  # Deployable applications/services
│   ├── member-onboarding/                 # Example app (Cloud Run service)
│   │   ├── src/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── ...
│   ├── certificate-generator/
│   ├── persist-member/
│   └── ...
│
├── libs/                                  # Shared libraries (reusable code)
│   ├── http-helpers/                      # HTTP server helpers
│   ├── gcp-helpers/                       # GCP helpers
│   └── ...
│
├── infra/                                 # Deployment/infra configs
│   ├── apps.yaml
│   └── cloudbuild.docker.yaml
│
├── .github/
│   └── workflows/                             # CI/CD pipelines
│       ├── deploy.yaml
│       └── infra-check.yaml
│
├── docs/                                      # Developer documentation
│   └── *.md
│
├── pnpm-workspace.yaml                        # Defines workspace boundaries
├── pnpm-lock.yaml
└── README.md
```

### 🔍 Key Concepts

#### **Apps**
Everything is organized by deployable application under `apps/`.  
Example: `apps/member-onboarding` is one self-contained Cloud Run service.

Each app includes:
- Its own `src/`
- Its own build script
- Independent Cloud Run deployment
- Independent CI enforcement

This keeps services loosely coupled but still easy to manage inside a single repo.

#### **Workspaces**
The repo uses **pnpm workspaces** for:
- Fast installs  
- Shared node_modules caching  
- Easy cross-package development  
- Consistent tooling across all services  

---

## 🧰 Tech Stack

### **Languages & Frameworks**
- **TypeScript (Node.js 22)**
- **Express** for HTTP servers
- **pnpm** for package/workspace management

### **Infrastructure**
- **Google Cloud Run** for hosting all services
- **Google Artifact Registry** for storing built images
- **Cloud Build** used automatically by Cloud Run source deploys
- **Workload Identity Federation** for GitHub → GCP authentication
- **Identity-Aware Proxy (IAP)** planned for internal-site protection

---

## 🚀 CI/CD Workflows

One pipeline: **merge to `main` → auto-deploy.**

**pages.yaml** | Builds the `psm-portal` static export and publishes it to **GitHub Pages** on every push to `main`.
**security.yaml** | Report-only security scans (Gitleaks, pnpm audit, Semgrep, Trivy) on push to `main`.

The backend runs on **Wix Velo** + **Wix CMS** (see `wix-velo/CUTOVER.md`); there is no Cloud Run /
Artifact Registry / Cloud Build / Terraform pipeline anymore.

---

## 🔀 Branch Strategy

- **main** → the only long-lived branch; merging to it deploys to GitHub Pages.
- Feature branches → daily development, PR'd into `main`.

The old `dev`/`prod` split (staging vs. Cloud Run production) has been retired.

---

## 🛠️ Local Development

Install dependencies:

```bash
pnpm install
