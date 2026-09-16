import next from "eslint-config-next";
import ts from "typescript-eslint";

const config = [
  ...next,
  ...ts.configs.recommended,
  { ignores: [".next/**", "node_modules/**", "out/**"] },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Generated artwork is served from IndexedDB object URLs, which
      // next/image cannot optimise.
      "@next/next/no-img-element": "off",
    },
  },
];

export default config;
