#!/usr/bin/env node

/**
 * Apply IAM bindings described in apps/<app>/iam.yaml.
 * Intentionally dependency-free so it can run in CI without installing extra packages.
 */

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--app" && argv[i + 1]) {
      args.app = argv[++i];
    } else if (arg === "--project" && argv[i + 1]) {
      args.project = argv[++i];
    }
  }
  return args;
}

function readAppsYaml(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing apps.yaml at ${filePath}`);
  }
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const apps = [];
  let current = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line === "apps:") continue;
    if (line.startsWith("- ")) {
      if (current && current.id) apps.push(current);
      current = {};
      const rest = line.slice(2);
      if (rest.includes(":")) {
        const [k, ...v] = rest.split(":");
        current[k.trim()] = v.join(":").trim().replace(/^"|"$/g, "");
      }
      continue;
    }
    if (!current) continue;
    const [k, ...v] = line.split(":");
    if (!k || v.length === 0) continue;
    const key = k.trim();
    const value = v.join(":").trim().replace(/^"|"$/g, "");
    if (key === "secrets") continue;
    current[key] = value;
  }
  if (current && current.id) apps.push(current);
  return apps;
}

function replacePlaceholders(value, projectId) {
  if (typeof value !== "string") return value;
  return value.replace(/PROJECT_ID/g, projectId);
}

function parseIamManifest(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing IAM manifest at ${filePath}`);
  }
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/);
  const manifest = { roles: [], resources: [] };
  let section = null;
  let currentResource = null;
  let resourceRoles = false;

  const cleanValue = (value) => value.replace(/^"|"$/g, "");

  for (const raw of lines) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const indent = raw.match(/^(\s*)/)[1].length;
    const trimmed = raw.trim();

    if (indent === 0 && trimmed.startsWith("serviceAccount:")) {
      manifest.serviceAccount = cleanValue(trimmed.split(":").slice(1).join(":").trim());
      section = null;
      continue;
    }
    if (indent === 0 && trimmed === "roles:") {
      section = "roles";
      continue;
    }
    if (indent === 0 && trimmed === "resources:") {
      section = "resources";
      currentResource = null;
      continue;
    }

    if (section === "roles" && trimmed.startsWith("- ")) {
      manifest.roles.push(cleanValue(trimmed.slice(2).trim()));
      continue;
    }

    if (section === "resources") {
      if (raw.startsWith("  - ")) {
        currentResource = {};
        manifest.resources.push(currentResource);
        resourceRoles = false;
        const rest = trimmed.slice(2).trim();
        if (rest.includes(":")) {
          const [k, ...v] = rest.split(":");
          currentResource[k.trim()] = cleanValue(v.join(":").trim());
        }
        continue;
      }
      if (!currentResource) continue;

      if (indent >= 4 && trimmed.startsWith("roles:")) {
        currentResource.roles = [];
        resourceRoles = true;
        continue;
      }
      if (resourceRoles && trimmed.startsWith("- ")) {
        currentResource.roles.push(cleanValue(trimmed.slice(2).trim()));
        continue;
      }
      if (trimmed.includes(":")) {
        const [k, ...v] = trimmed.split(":");
        currentResource[k.trim()] = cleanValue(v.join(":").trim());
        resourceRoles = false;
      }
    }
  }

  if (!manifest.serviceAccount) {
    throw new Error(`IAM manifest ${filePath} missing serviceAccount`);
  }
  if (!Array.isArray(manifest.roles) || manifest.roles.length === 0) {
    throw new Error(`IAM manifest ${filePath} must declare at least one role`);
  }
  manifest.resources = (manifest.resources || []).map((res) => ({
    ...res,
    roles: res.roles || []
  }));
  return manifest;
}

function normalizeServiceAccount(raw, projectId) {
  const replaced = replacePlaceholders(raw, projectId);
  if (!replaced) {
    throw new Error("serviceAccount value cannot be empty");
  }

  let email = replaced;

  if (replaced.startsWith("projects/")) {
    const parts = replaced.split("/");
    email = parts[parts.length - 1];
  } else if (!replaced.includes("@")) {
    email = `${replaced}@${projectId}.iam.gserviceaccount.com`;
  }

  if (!email.includes("@")) {
    throw new Error(
      `Service account "${raw}" must include an email or projects/... path`
    );
  }

  return { email };
}

function ensureServiceAccount(projectId, email, appId) {
  try {
    run(
      [
        "gcloud iam service-accounts describe",
        email,
        `--project="${projectId}"`,
        "--quiet"
      ].join(" ")
    );
    return;
  } catch (err) {
    console.log(`Service account ${email} not found. Creating it...`);
  }

  const accountId = email.split("@")[0];
  run(
    [
      "gcloud iam service-accounts create",
      accountId,
      `--project="${projectId}"`,
      `--display-name="${appId} service account"`,
      "--quiet"
    ].join(" ")
  );
}

function run(cmd, options = {}) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", ...options });
}

function applyProjectRoles(projectId, member, roles) {
  roles.forEach((role) => {
    run(
      [
        "gcloud projects add-iam-policy-binding",
        projectId,
        `--member="${member}"`,
        `--role="${role}"`,
        "--quiet"
      ].join(" ")
    );
  });
}

function applyResourceBindings(projectId, member, resources) {
  resources.forEach((resource) => {
    if (!resource.type || !resource.name) {
      throw new Error(`Invalid resource entry: ${JSON.stringify(resource)}`);
    }
    if (!resource.roles || resource.roles.length === 0) return;
    switch (resource.type) {
      case "storage.bucket": {
        resource.roles.forEach((role) => {
          run(
            [
              "gcloud storage buckets add-iam-policy-binding",
              resource.name,
              `--member="${member}"`,
              `--role="${role}"`,
              `--project="${projectId}"`,
              "--quiet"
            ].join(" ")
          );
        });
        break;
      }
      default:
        throw new Error(`Unsupported resource type "${resource.type}"`);
    }
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const appId = args.app;
  const projectId = args.project || process.env.GCP_PROJECT_ID;

  const allowCreate =
  (process.env.ALLOW_SA_CREATE || "false").toLowerCase() === "true";

  if (!projectId) {
    console.error("GCP project id is required (pass --project or set GCP_PROJECT_ID).");
    process.exit(1);
  }

  const appsConfig = readAppsYaml(path.join(repoRoot, "infra", "apps.yaml"));
  const appConfig = appsConfig.find((app) => app.id === appId);
  if (!appConfig) {
    console.log(`No app config found for "${appId}", skipping IAM bindings.`);
    return;
  }
  if (!appConfig.iam_file) {
    console.log(`App "${appId}" does not declare iam_file. Nothing to apply.`);
    return;
  }
  const manifestPath = path.join(repoRoot, appConfig.iam_file);
  const manifest = parseIamManifest(manifestPath);
  const { email: serviceAccountEmail } = normalizeServiceAccount(
    manifest.serviceAccount,
    projectId
  );

  try {
  run(
    [
      "gcloud iam service-accounts describe",
      serviceAccountEmail,
      `--project="${projectId}"`,
      "--quiet"
    ].join(" ")
  );
} catch (err) {
  if (!allowCreate) {
    console.error(
      `Service account ${serviceAccountEmail} does not exist and ALLOW_SA_CREATE=false. ` +
      `Create it once in GCP (or set ALLOW_SA_CREATE=true).`
    );
    process.exit(1);
  }
  console.log(`Service account ${serviceAccountEmail} not found. Creating it...`);
  const accountId = serviceAccountEmail.split("@")[0];
  run(
    [
      "gcloud iam service-accounts create",
      accountId,
      `--project="${projectId}"`,
      `--display-name="${appId} service account"`,
      "--quiet"
    ].join(" ")
  );
}

  const member = `serviceAccount:${serviceAccountEmail}`;
  const resolvedResources = (manifest.resources || []).map((resource) => ({
    ...resource,
    name: resource.name ? replacePlaceholders(resource.name, projectId) : resource.name
  }));

  console.log(`Applying IAM bindings for ${appId} (${serviceAccountEmail})`);
  applyProjectRoles(projectId, member, manifest.roles);
  applyResourceBindings(projectId, member, resolvedResources);
  console.log(`IAM bindings applied for ${appId}`);
}

main();
