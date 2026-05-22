import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module; don't try to bundle it with webpack/turbopack.
  serverExternalPackages: ["better-sqlite3", "@huggingface/transformers"],
};

export default nextConfig;
