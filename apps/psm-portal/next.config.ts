import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Static export for GitHub Pages — no Node server, no API routes.
  output: "export",
  turbopack: {
    root: path.resolve(__dirname, "../..")
  },
  images: {
    // The Next image optimizer doesn't run on a static export; serve images as-is.
    unoptimized: true
  }
};
export default nextConfig;
