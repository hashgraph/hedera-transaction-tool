const pluginVue = require('eslint-plugin-vue');
const vueTsEslintConfig = require('@vue/eslint-config-typescript');
const skipFormatting = require('@vue/eslint-config-prettier/skip-formatting');

module.exports = [
  {
    name: 'app/files-to-lint',
    files: ['**/*.{js,jsx,ts,tsx,cts,mts,vue}'],
  },
  {
    name: 'app/files-to-ignore',
    ignores: [
      '**/eslint.config.cjs',
      '**/node_modules',
      '**/dist',
      '**/dist-electron',
      '**/out',
      '**/.gitignore',
    ],
  },
  ...pluginVue.configs['flat/essential'],
  ...vueTsEslintConfig(),
  skipFormatting,
  {
    rules: {
      'vue/require-default-prop': 'off',
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'newline-per-chained-call': 'off',
    },
  },
];
