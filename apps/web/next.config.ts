import type { NextConfig } from "next";
import { withTamagui } from "@tamagui/next-plugin";

const tamaguiPlugin = withTamagui({
  config: "./tamagui.config.ts",
  components: ["tamagui"],
  appDir: true,
  disableExtraction: true,
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["react-native-web", "tamagui", "@tamagui/core"],
  webpack(config) {
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      {
        module: /ox[\\/]_esm[\\/]tempo[\\/]internal[\\/]virtualMasterPool\.js/,
        message: /Critical dependency: the request of a dependency is an expression/,
      },
    ];

    return config;
  },
};

export default tamaguiPlugin(nextConfig);
