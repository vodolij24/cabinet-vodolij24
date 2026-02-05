import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // 1. Ігноруємо все зайве (білди, кеш, статичні файли)
  {
    ignores: [".next/*", "node_modules/*", "dist/*", "public/*"],
  },

  // 2. Базові налаштування Next.js
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // 3. Твої кастомні правила (більш гнучкі)
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    rules: {
      // Вимикаємо те, що найбільше дратує в старому коді
      "no-var": "off",
      "prefer-const": "off",
      "@typescript-eslint/no-unused-vars": "off", // краще warn, ніж off, щоб бачити сміття
      "@typescript-eslint/no-explicit-any": "off", // дозволяє 'any', якщо код старий
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "react/no-unescaped-entities": "off", // щоб не сварилося на лапки в тексті
      "import/no-anonymous-default-export": "off",
      "@typescript-eslint/no-this-alias": "off",
      "@typescript-eslint/no-wrapper-object-types": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
      "@typescript-eslint/no-unnecessary-type-constraint": "off",
    },
  },
];

export default eslintConfig;
