import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Static export for GitHub Pages — no Node server, no API routes.
  output: "export",
  // Emit /page/index.html so both /page and /page/ work on GitHub Pages (no 404 on pasted links).
  trailingSlash: true,
  turbopack: {
    root: path.resolve(__dirname, "../..")
  },
  images: {
    // The Next image optimizer doesn't run on a static export; serve images as-is.
    unoptimized: true
  }
};
export default nextConfig;
