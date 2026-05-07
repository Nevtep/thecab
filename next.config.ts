import type { NextConfig } from "next";

import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.alias ??= {};
    config.resolve.alias["@react-native-async-storage/async-storage"] = path.resolve(
      process.cwd(),
      "src/shims/react-native-async-storage.ts"
    );
    config.resolve.alias["pino-pretty"] = path.resolve(
      process.cwd(),
      "src/shims/pino-pretty.ts"
    );

    return config;
  }
};

export default nextConfig;