import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["**/*.js", "**/*.jsx"], // додатково (запобігає конфліктам)
    ...compat.extends("next/core-web-vitals", "next/typescript"),
    rules: {
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-require-imports": "off",
      "no-var": "off",
    },
  },
];

export default eslintConfig;
