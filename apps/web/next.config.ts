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
};

export default tamaguiPlugin(nextConfig);
