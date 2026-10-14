import { fileURLToPath } from 'node:url'

import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import { importX } from 'eslint-plugin-import-x'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const frontendDir = fileURLToPath(new URL('./apps/frontend/', import.meta.url))
const backendDir = fileURLToPath(new URL('./apps/backend/', import.meta.url))
const rootDir = fileURLToPath(new URL('./', import.meta.url))

export default defineConfig([
  globalIgnores([
    '**/dist/**',
    '**/coverage/**',
    '**/.wrangler/**',
    '**/.cloudflare/**',
    '**/worker-configuration.d.ts',
    '.husky/_/**',
  ]),
  {
    files: ['**/*.{js,mjs}'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'simple-import-sort': simpleImportSort,
      'import-x': importX,
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },
  {
    files: ['apps/frontend/src/**/*.{ts,tsx}'],
    extends: [
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: { globals: globals.browser },
    rules: {
      'import-x/no-extraneous-dependencies': [
        'error',
        {
          packageDir: frontendDir,
          devDependencies: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/backend/**'],
              message: 'API 経由で backend にアクセスしてください。',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'apps/frontend/src/**/*.{test,spec}.{ts,tsx}',
      'apps/frontend/src/test/**/*.ts',
    ],
    rules: {
      'import-x/no-extraneous-dependencies': [
        'error',
        { packageDir: [frontendDir, rootDir], devDependencies: true },
      ],
    },
  },
  {
    files: ['apps/backend/src/**/*.ts'],
    rules: {
      'import-x/no-extraneous-dependencies': [
        'error',
        { packageDir: backendDir, devDependencies: false },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/frontend/**'],
              message:
                'backend から frontend の実装を import しないでください。',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/backend/src/**/*.{test,spec}.ts'],
    rules: {
      'import-x/no-extraneous-dependencies': [
        'error',
        { packageDir: [backendDir, rootDir], devDependencies: true },
      ],
    },
  },
  prettier,
])
