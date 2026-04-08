import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@tass/db", "@tass/domain", "@tass/config"],
};

export default nextConfig;
