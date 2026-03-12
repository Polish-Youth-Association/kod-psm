#!/usr/bin/env node
// Patches packages for Node.js 22 + Next.js 16 + pnpm monorepo compatibility.
//
// Fix 1: Next.js compiled package.json files are missing "type":"commonjs".
//   Node.js 22 throws ERR_INVALID_PACKAGE_CONFIG when encountering these.
//
// Fix 2: @opentelemetry/api ESM build directory has no package.json with
//   "type":"module", so Turbopack can't parse the ESM exports correctly.

const fs = require("fs");
const path = require("path");

// --- Fix 1: patch next/dist/compiled package.json files ---
let nextPkg;
try {
  nextPkg = require.resolve("next/package.json");
} catch {
  console.log("[patch-next-node22] next package not found, skipping.");
  process.exit(0);
}

const compiledDir = path.join(path.dirname(nextPkg), "dist", "compiled");
let patched = 0;

function patchPackageJson(pkgPath, patch) {
  if (!fs.existsSync(pkgPath)) return 0;
  try {
    const obj = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    let changed = false;
    for (const [k, v] of Object.entries(patch)) {
      if (obj[k] === undefined) {
        obj[k] = v;
        changed = true;
      }
    }
    if (!changed) return 0;
    fs.writeFileSync(pkgPath, JSON.stringify(obj));
    return 1;
  } catch {
    return 0;
  }
}

if (fs.existsSync(compiledDir)) {
  fs.readdirSync(compiledDir).forEach((entry) => {
    const fullPath = path.join(compiledDir, entry);
    if (!fs.statSync(fullPath).isDirectory()) return;
    if (entry.startsWith("@")) {
      fs.readdirSync(fullPath).forEach((sub) => {
        patched += patchPackageJson(path.join(fullPath, sub, "package.json"), { type: "commonjs" });
      });
    } else {
      patched += patchPackageJson(path.join(fullPath, "package.json"), { type: "commonjs" });
    }
  });
  console.log(`[patch-next-node22] Fix 1: patched ${patched} compiled package.json files.`);
}

// --- Fix 2: patch @opentelemetry/api ESM directory ---
let otelEsmDir;
try {
  const otelPkg = require.resolve("@opentelemetry/api/package.json");
  otelEsmDir = path.join(path.dirname(otelPkg), "build", "esm");
} catch {
  // @opentelemetry/api not in this package's scope
}

if (otelEsmDir && fs.existsSync(otelEsmDir)) {
  const esmPkgPath = path.join(otelEsmDir, "package.json");
  if (!fs.existsSync(esmPkgPath)) {
    fs.writeFileSync(esmPkgPath, JSON.stringify({ type: "module" }));
    console.log("[patch-next-node22] Fix 2: added type:module to @opentelemetry/api/build/esm.");
  } else {
    console.log("[patch-next-node22] Fix 2: @opentelemetry/api/build/esm/package.json already exists.");
  }
}

// --- Fix 3: clear Turbopack cache so patched files take effect ---
const turbopackCache = path.join(__dirname, "..", ".next", "cache", "turbopack");
if (fs.existsSync(turbopackCache)) {
  fs.rmSync(turbopackCache, { recursive: true, force: true });
  console.log("[patch-next-node22] Fix 3: cleared stale Turbopack cache.");
}
