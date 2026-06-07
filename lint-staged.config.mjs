export default {
  'backend/**/*.ts': [
    'prettier --write --log-level=error',
    'eslint --fix --config backend/eslint.config.mjs',
  ],
  'frontend/**/*.{ts,tsx,js,jsx}': [
    'prettier --write --log-level=error',
    'eslint --fix --config frontend/eslint.config.mjs',
  ],
};
