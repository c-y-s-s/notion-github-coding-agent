import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  typedRoutes: false,
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
};

export default nextConfig;
