import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  // APIs and Socket.io are served by the existing Tripanza HTTP server.
  experimental: { cpus: 2 },
};

export default nextConfig;
