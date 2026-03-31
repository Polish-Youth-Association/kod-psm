#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const repoRoot = path.resolve(__dirname, '..');

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeFile(filePath: string, content: string) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('  created:', path.relative(repoRoot, filePath));
}

async function main() {
  console.log('\n🔧 Create a new app\n');

  const appName = await ask('App name (human readable, e.g. "New Member Onboarding"): ');
  const defaultSlug = slugify(appName);
  const appSlugInput = await ask(`App ID/slug [${defaultSlug}]: `);
  const appSlug = appSlugInput || defaultSlug;

  const rolesInput = await ask(
    'IAM roles (comma-separated, e.g. roles/datastore.user,roles/storage.objectAdmin) [none]: '
  );
  const roles = rolesInput
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);

  const envVarsInput = await ask(
    'Plain env var names (comma-separated, e.g. GCP_PROJECT_ID,BUCKET_NAME) [none]: '
  );
  const envVarNames = envVarsInput
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  const secretsInput = await ask(
    'Secret Manager secrets (comma-separated ENV_VAR=secret-name, e.g. API_KEY=my-api-key) [none]: '
  );
  const secrets = secretsInput
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, s) => {
      const [k, v] = s.split('=');
      if (k && v) acc[k.trim()] = v.trim();
      return acc;
    }, {});

  const absAppPath = path.join(repoRoot, 'apps', appSlug);
  const absTfPath = path.join(repoRoot, 'infra', 'terraform', 'apps', appSlug);

  console.log('\n📁 Scaffolding app...\n');

  // ── App source files ──────────────────────────────────────────────────────

  ensureDir(path.join(absAppPath, 'src'));

  writeFile(
    path.join(absAppPath, 'package.json'),
    JSON.stringify(
      {
        name: `@kod-psm/${appSlug}`,
        version: '0.1.0',
        private: true,
        main: 'dist/index.js',
        types: 'dist/index.d.ts',
        scripts: {
          build: 'tsc -p tsconfig.json',
          start: 'node dist/index.js',
          dev: 'ts-node-dev --respawn --transpile-only src/index.ts',
        },
        dependencies: {
          '@kod-psm/http-helpers': 'workspace:*',
        },
        devDependencies: {
          '@types/node': '^20.0.0',
          'ts-node-dev': '^2.0.0',
          typescript: '^5.6.0',
        },
      },
      null,
      2
    ) + '\n'
  );

  writeFile(
    path.join(absAppPath, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          module: 'CommonJS',
          moduleResolution: 'Node',
          strict: true,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          forceConsistentCasingInFileNames: true,
          skipLibCheck: true,
          outDir: 'dist',
          rootDir: 'src',
        },
        include: ['src'],
        exclude: ['node_modules', 'dist'],
      },
      null,
      2
    ) + '\n'
  );

  writeFile(
    path.join(absAppPath, 'src', 'index.ts'),
    `import { createApp, listen } from '@kod-psm/http-helpers';

const PORT = Number(process.env.PORT) || 8080;

const app = createApp((router) => {
  router.get('/', (_req, res) => {
    res.json({ ok: true, service: '${appSlug}' });
  });
});

listen(app, PORT, () => {
  console.log('🚀 ${appName} (${appSlug}) running on port ' + PORT);
});
`
  );

  writeFile(
    path.join(absAppPath, 'Dockerfile'),
    `FROM node:22-slim AS builder
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json ./
COPY libs ./libs
COPY apps/${appSlug} ./apps/${appSlug}

RUN pnpm install --frozen-lockfile --filter "@kod-psm/${appSlug}..."
RUN pnpm -r --filter "@kod-psm/${appSlug}..." run build
RUN pnpm --filter "@kod-psm/${appSlug}" deploy --prod --legacy /out

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
COPY --from=builder /out ./
CMD ["node", "dist/index.js"]
`
  );

  // ── Terraform config ──────────────────────────────────────────────────────

  ensureDir(absTfPath);

  const rolesHcl =
    roles.length > 0
      ? `[\n${roles.map((r) => `    "${r}",`).join('\n')}\n  ]`
      : '[]';

  const envVarsHcl =
    envVarNames.length > 0
      ? `\n  env_vars = {\n${envVarNames.map((v) => `    ${v} = "" # TODO: set value`).join('\n')}\n  }\n`
      : '';

  const secretsHcl =
    Object.keys(secrets).length > 0
      ? `\n  secrets = {\n${Object.entries(secrets)
          .map(([k, v]) => `    ${k} = "${v}"`)
          .join('\n')}\n  }\n`
      : '';

  writeFile(
    path.join(absTfPath, 'main.tf'),
    `variable "project_id" {
  type = string
}

variable "region" {
  type    = string
  default = "us-central1"
}

module "sa" {
  source     = "../../modules/app"
  project_id = var.project_id
  app_name   = "${appSlug}"
  roles      = ${rolesHcl}
}

module "service" {
  source     = "../../modules/cloud-run"
  project_id = var.project_id
  app_name   = "${appSlug}"
  region     = var.region
  sa_email   = module.sa.service_account_email
${envVarsHcl}${secretsHcl}}
`
  );

  writeFile(
    path.join(absTfPath, 'outputs.tf'),
    `output "service" {
  value = module.service
}
`
  );

  // ── Summary ───────────────────────────────────────────────────────────────

  const tfModuleName = appSlug.replace(/-/g, '_');

  console.log(`
✅ App scaffolded at:    apps/${appSlug}/
✅ Terraform config at:  infra/terraform/apps/${appSlug}/

Next steps:

1. Add the module to infra/terraform/envs/dev/main.tf:

   module "${tfModuleName}" {
     source     = "../../apps/${appSlug}"
     project_id = var.project_id
     region     = local.region
   }

2. Do the same in infra/terraform/envs/prod/main.tf when ready.

3. Install dependencies:
   pnpm install

4. Start dev server:
   pnpm --filter @kod-psm/${appSlug} run dev

5. Push to dev — terraform will create the service account, IAM, and
   Cloud Run service. CI will build and deploy the image.
`);
}

main().catch((err) => {
  console.error('Error creating app:', err);
  process.exit(1);
});
