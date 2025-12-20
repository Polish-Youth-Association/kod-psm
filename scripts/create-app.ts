#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

type AppConfig = {
  id: string;
  name: string;
  path: string;
  region: string;
  artifact_repo: string;
  secret_prefix: string;
  iam_file?: string;
  secrets: string[];
};

type AppsYaml = {
  apps: AppConfig[];
};

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

function readAppsYaml(filePath: string): AppsYaml {
  if (!fs.existsSync(filePath)) {
    return { apps: [] };
  }

  const content = fs.readFileSync(filePath, 'utf8');
  // very small YAML subset parser since we don't want extra deps here
  // Expect structure like:
  // apps:
  //   - id: foo
  //     name: "Foo"
  const lines = content.split('\n');
  const apps: AppConfig[] = [];
  let current: Partial<AppConfig> | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line === 'apps:' || line === 'apps:') continue;

    if (line.startsWith('- ')) {
      // start of new app
      if (current && current.id) {
        apps.push(current as AppConfig);
      }
      current = {};
      const kv = line.slice(2).split(':');
      if (kv.length === 2) {
        const key = kv[0].trim();
        const value = kv[1].trim().replace(/^"|"$/g, '');
        (current as any)[key] = value;
      }
    } else if (current) {
      const kv = line.split(':');
      if (kv.length >= 2) {
        const key = kv[0].trim();
        const value = kv.slice(1).join(':').trim().replace(/^"|"$/g, '');
        if (key === 'secrets') {
          // secrets will be overwritten when we write out
          continue;
        }
        (current as any)[key] = value;
      }
    }
  }
  if (current && current.id) {
    apps.push(current as AppConfig);
  }

  return { apps };
}

function writeAppsYaml(filePath: string, apps: AppsYaml) {
  const lines: string[] = [];
  lines.push('apps:');
  for (const app of apps.apps) {
    lines.push(`  - id: ${app.id}`);
    lines.push(`    name: "${app.name}"`);
    lines.push(`    path: "${app.path}"`);
    lines.push(`    region: "${app.region}"`);
    lines.push(`    artifact_repo: "${app.artifact_repo}"`);
    lines.push(`    secret_prefix: "${app.secret_prefix}"`);
    if (app.iam_file) {
      lines.push(`    iam_file: "${app.iam_file}"`);
    }
    if (app.secrets && app.secrets.length > 0) {
      lines.push('    secrets:');
      for (const s of app.secrets) {
        lines.push(`      - ${s}`);
      }
    } else {
      lines.push('    secrets: []');
    }
  }
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
}

async function main() {
  console.log('🔧 Create a new app\n');

  const appName = await ask('App name (human readable, e.g. "New Member Onboarding"): ');
  const defaultSlug = slugify(appName);
  const appSlugInput = await ask(`App ID/slug [${defaultSlug}]: `);
  const appSlug = appSlugInput || defaultSlug;
  const pkgName = `@kod-psm/${appSlug}`;

  const defaultRegion = 'us-central1';
  const regionInput = await ask(`GCP region [${defaultRegion}]: `);
  const region = regionInput || defaultRegion;

  const defaultArtifactRepo = appSlug;
  const artifactRepoInput = await ask(
    `Artifact Registry repo name [${defaultArtifactRepo}]: `
  );
  const artifactRepo = artifactRepoInput || defaultArtifactRepo;

  const defaultSecretPrefix = appSlug;
  const secretPrefixInput = await ask(
    `Secret Manager prefix (used as logical grouping) [${defaultSecretPrefix}]: `
  );
  const secretPrefix = secretPrefixInput || defaultSecretPrefix;

  const secretsInput = await ask(
    'Comma-separated required secret names (e.g. SMTP_HOST,SMTP_PORT) [none]: '
  );
  const secrets =
    secretsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean) || [];

  const appPath = path.join('apps', appSlug);
  const iamRelativePath = path.posix.join('apps', appSlug, 'iam.yaml');
  const absAppPath = path.join(repoRoot, appPath);

  // 1) Create app directory and files
  ensureDir(path.join(absAppPath, 'src'));

  const pkgJson = {
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
  };

  fs.writeFileSync(
    path.join(absAppPath, 'package.json'),
    JSON.stringify(pkgJson, null, 2),
    'utf8'
  );

  const tsconfig = {
    compilerOptions: {
        target: "ES2020",
        module: "CommonJS",
        moduleResolution: "Node",
        strict: true,
    
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
    
        forceConsistentCasingInFileNames: true,
        skipLibCheck: true,
    
        outDir: "dist",
        rootDir: "src"
      },
      include: ["src"],
      exclude: ["node_modules", "dist"],
  };

  fs.writeFileSync(
    path.join(absAppPath, 'tsconfig.json'),
    JSON.stringify(tsconfig, null, 2),
    'utf8'
  );

  const indexTs = `
import { createApp, listen } from '@kod-psm/http-helpers';

const PORT = Number(process.env.PORT) || 8080;

const app = createApp((router) => {
  router.get('/', (_req, res) => {
    res.json({
      ok: true,
      service: '${appSlug}',
    });
  });
});

listen(app, PORT, () => {
  console.log('🚀 ${appName} (${appSlug}) running on port ' + PORT);
});
`.trimStart();

  fs.writeFileSync(path.join(absAppPath, 'src', 'index.ts'), indexTs, 'utf8');

  const dockerfile = `
  FROM node:22-slim AS builder
  WORKDIR /repo

  RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

  COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
  COPY libs ./libs
  COPY apps/${appSlug} ./apps/${appSlug}

  RUN pnpm install --frozen-lockfile --filter "@kod-psm/${appSlug}..."
  RUN pnpm -r --filter "@kod-psm/${appSlug}..." run build

  # produce self-contained output
  RUN pnpm --filter "@kod-psm/${appSlug}" deploy --prod --legacy /out

  FROM node:22-slim AS runtime
  WORKDIR /app
  ENV NODE_ENV=production
  ENV PORT=8080
  EXPOSE 8080

  # run the deployed bundle
  COPY --from=builder /out ./

  CMD ["node", "dist/index.js"]
  `.trimStart();

  fs.writeFileSync(path.join(absAppPath, 'Dockerfile'), dockerfile, 'utf8');

  const iamYaml = `
serviceAccount: projects/PROJECT_ID/serviceAccounts/${appSlug}@PROJECT_ID.iam.gserviceaccount.com
roles:
  - roles/run.invoker

resources: []
`.trimStart();

  fs.writeFileSync(path.join(absAppPath, 'iam.yaml'), iamYaml + '\n', 'utf8');

  // 2) Update infra/apps.yaml
  const appsYamlPath = path.join(repoRoot, 'infra', 'apps.yaml');
  ensureDir(path.dirname(appsYamlPath));

  const appsData = readAppsYaml(appsYamlPath);

  const newConfig: AppConfig = {
    id: appSlug,
    name: appName,
    path: appPath,
    region,
    artifact_repo: artifactRepo,
    secret_prefix: secretPrefix,
    iam_file: iamRelativePath,
    secrets,
  };

  // prevent duplicate id
  const existingIndex = appsData.apps.findIndex((a) => a.id === appSlug);
  if (existingIndex >= 0) {
    appsData.apps[existingIndex] = newConfig;
  } else {
    appsData.apps.push(newConfig);
  }

  writeAppsYaml(appsYamlPath, appsData);

  console.log('\n✅ App scaffolded at:', appPath);
  console.log('✅ Infra config updated:', path.relative(repoRoot, appsYamlPath));
  console.log(
    '\nNext steps:\n' +
      '1) Run: pnpm install\n' +
      `2) Run: pnpm --filter @kod-psm/${appSlug} run build\n` +
      '3) Wire a deploy GitHub Action for this app (we can template that next).\n'
  );
}

main().catch((err) => {
  console.error('Error creating app:', err);
  process.exit(1);
});
