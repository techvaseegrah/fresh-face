// eslint.config.mjs
import nextPlugin from '@next/eslint-plugin-next';

export default [
  {
    files: ['**/*.{js,mjs,cjs,jsx,mjs,ts,tsx,mts}'],
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
];