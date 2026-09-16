import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Emits a self-contained server bundle so the runtime image can ship
  // without node_modules. Keeps the deployed image small.
  output: "standalone",
  // Next writes AGENTS.md/CLAUDE.md into the repo root otherwise.
  agentRules: false,
  // Gemini image generation can take a while for large batches.
  serverExternalPackages: [],
  experimental: {
    proxyTimeout: 300_000,
  },
};

export default nextConfig;
