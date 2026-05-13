import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/design-system/**", "src/providers/tamagui-provider.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "tamagui",
              message: "Import DS components from '@/design-system' instead of raw Tamagui.",
            },
            {
              name: "lucide-react",
              message: "Import icons from '@/design-system' instead of lucide-react directly.",
            },
            {
              name: "recharts",
              message: "Import charts from '@/design-system' instead of recharts directly.",
            },
          ],
          patterns: [
            {
              group: ["@tamagui/*"],
              message: "Import DS components from '@/design-system' instead of @tamagui packages.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".tamagui/**",
  ]),
]);

export default eslintConfig;
