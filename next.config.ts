import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // Self-contained server build for the Docker image.
  output: "standalone",
  // Document uploads (decided 11 Oct 2026): up to 25 MB per file, a few files at once.
  experimental: {
    serverActions: { bodySizeLimit: "100mb" },
    proxyClientMaxBodySize: "100mb",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default createNextIntlPlugin()(nextConfig);
