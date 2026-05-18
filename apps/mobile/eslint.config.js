import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      // React Native uses require() extensively for native modules
      '@typescript-eslint/no-require-imports': 'off',
      'no-useless-catch': 'warn',
    },
  },
  {
    // CommonJS config files (babel, metro, jest, app.config)
    files: ['**/*.config.js', '**/babel.config.js', '**/metro.config.js'],
    languageOptions: {
      globals: {
        module: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
        exports: 'readonly',
      },
    },
    rules: {
      'no-undef': 'off',
    },
  },
  {
    ignores: [
      'dist/**',
      'build/**',
      'node_modules/**',
      '.expo/**',
      'coverage/**',
    ],
  },
);
