import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  // ignore build artifacts
  { ignores: ['dist', 'node_modules', 'coverage'] },

  js.configs.recommended,
  // TypeScript recommended **type-checked** rules
  // (requires parserOptions.project)
  ...tseslint.configs.recommendedTypeChecked,

  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        // Make project path resolution robust no matter where ESLint runs from
        tsconfigRootDir: process.cwd(),
      },
    },
    plugins: { prettier: prettierPlugin },
    rules: {
      // keep 'any' as a warning for now
      '@typescript-eslint/no-explicit-any': 'warn',
      // Run Prettier as an ESLint rule (reports formatting as errors)
      'prettier/prettier': 'error',
    },
  },

  // Turn off rules that conflict with Prettier
  prettierConfig,
]);
