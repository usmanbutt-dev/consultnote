import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import typescript from "typescript-eslint";

export default defineConfig([
  js.configs.recommended,
  ...typescript.configs.recommended,
  nextPlugin.configs["core-web-vitals"],
  reactHooks.configs.flat.recommended,
  globalIgnores([
    ".next/**",
    "out/**",
    "dist/**",
    "next-env.d.ts",
    ".superpowers/**",
    ".codegraph/**",
    "test-results/**",
    "playwright-report/**",
  ]),
]);
