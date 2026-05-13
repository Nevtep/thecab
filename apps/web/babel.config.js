module.exports = {
  presets: ["next/babel"],
  plugins: [
    [
      "@tamagui/babel-plugin",
      {
        components: ["tamagui"],
        config: "./tamagui.config.ts",
      },
    ],
  ],
};
