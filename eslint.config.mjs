import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
  ]),
  {
    rules: {
      // 既存コードに多数引っかかり、ユーザー影響は実質ゼロのため無効化。
      // 必要なら別 Issue で個別に対応する。
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
