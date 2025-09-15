import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import { defineConfig } from 'eslint/config';
import type { Linter } from 'eslint';

// Collect ONLY the rules from recommendedTypeChecked (so we can scope them)
const typeCheckedRules: Linter.RulesRecord = {};
for (const cfg of tseslint.configs.recommendedTypeChecked) {
  if (cfg.rules) Object.assign(typeCheckedRules, cfg.rules);
}

export default defineConfig([
  // ignore build artifacts
  { ignores: ['dist', 'node_modules', 'coverage'] },

  // Base JS rules
  js.configs.recommended,
  // Base TS rules (non type-aware) for ALL .ts, including config files
  ...tseslint.configs.recommended,

  // 1) Config files FIRST: lint w/o type info
  {
    files: ['eslint.config.ts', 'jest.config.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        // no `project` here -> parses without type info
        project: false,
      },
    },
    plugins: { prettier: prettierPlugin },
    rules: {
      'prettier/prettier': 'error',
    },
  },

  // 2) Typed rules ONLY for src + test
  {
    files: ['src/**/*.ts', 'test/**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        // Make project path resolution robust no matter where ESLint runs from
        tsconfigRootDir: process.cwd(),
      },
    },
    plugins: { '@typescript-eslint': tseslint.plugin, prettier: prettierPlugin },
    rules: {
      ...typeCheckedRules,
      // keep 'any' as a warning for now
      '@typescript-eslint/no-explicit-any': 'warn',
      // Run Prettier as an ESLint rule (reports formatting as errors)
      'prettier/prettier': 'error',
    },
  },

  // Tests only: allow underscore-prefixed unused args
  {
    files: ['test/**/*.ts'],
    rules: {
      // keep variable checks, but ignore args/caught errors that start with "_"
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },

  // Turn off rules that conflict with Prettier
  prettierConfig,
]);
