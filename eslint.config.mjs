import js from "@eslint/js";
import globals from "globals";
import babelParser from "@babel/eslint-parser";
import hooks from "eslint-plugin-react-hooks";
export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "vendor/**",
      "src/generated/**",
      "deliverables/**",
      "**/.tool-atlas-state/**",
    ],
  },
  {
    ...js.configs.recommended,
    files: ["scripts/**/*.mjs", "*.mjs"],
    languageOptions: { globals: globals.node },
    rules: { "no-unused-vars": "off" },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: babelParser,
      globals: globals.browser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          plugins: [
            ["@babel/plugin-syntax-typescript", { isTSX: true }],
            "@babel/plugin-syntax-jsx",
          ],
        },
      },
    },
    plugins: { "react-hooks": hooks },
    rules: { "react-hooks/rules-of-hooks": "error", "react-hooks/exhaustive-deps": "warn" },
  },
];
