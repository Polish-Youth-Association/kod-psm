import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "static.wixstatic.com"
      }
    ]
  },
  turbopack: {
    root: path.resolve(__dirname, "../..")
  }
};
export default nextConfig;