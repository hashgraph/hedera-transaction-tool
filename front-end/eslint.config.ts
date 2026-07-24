import * as pluginVue from 'eslint-plugin-vue';
import * as vueParser from 'vue-eslint-parser';
import tseslint from 'typescript-eslint';
import { withVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';

export default withVueTs(
  {
    rootDir: './src',
  },
  // {
  //   name: 'app/files-to-lint',
  //   files: ['**/*.{js,jsx,ts,tsx,cts,mts,vue}'],
  // },
  {
    name: 'app/files-to-ignore',
    ignores: [
      '**/eslint.config.cjs',
      '**/node_modules',
      '**/dist',
      '**/dist-electron',
      '**/out',
      '**/.gitignore',
      '**/release',
      '**/coverage',
      '**/src/generated/**',
    ],
  },
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommendedTypeChecked,
  {
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        projectService: {
          allowDefaultProject: ['eslint.config.ts', 'prisma.config.ts', 'src/tests/setup.ts'],
        },
      },
    },
  },
  {
    rules: {
      'vue/require-default-prop': 'off',
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'newline-per-chained-call': 'off',

      // To be enabled later…
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/no-unsafe-enum-comparison': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
    },
  },
  {
    files: ['src/**/*.{js,jsx,ts,tsx,cts,mts,vue}'],
    ignores: ['src/tests/**/*', 'src/main/modules/logger.ts', 'src/renderer/utils/logger.ts'],
    rules: {
      'no-console': 'warn',
    },
  },
  {
    ignores: ['src/tests/**/*'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/await-thenable': 'off',
      '@typescript-eslint/only-throw-error': 'off',
    },
  },
);
