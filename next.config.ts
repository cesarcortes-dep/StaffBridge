import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module; don't try to bundle it with webpack/turbopack.
  serverExternalPackages: ["better-sqlite3", "@huggingface/transformers"],

  // Make sure the seeded DB ships with the serverless bundle on Vercel.
  // Keys are Next.js route patterns; list every server-rendered route.
  outputFileTracingIncludes: {
    "/": ["./data/reviews.db"],
    "/queue": ["./data/reviews.db"],
    "/themes": ["./data/reviews.db"],
    "/property/[id]": ["./data/reviews.db"],
    "/api/draft-response": ["./data/reviews.db"],
  },
};

export default nextConfig;
