const eslintConfigPrettier = require('eslint-config-prettier');

module.exports = [
  {
    ignores: ['node_modules/**', 'prisma/migrations/**', 'coverage/**'],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        console: 'readonly',
        process: 'readonly',
        setImmediate: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-var': 'error',
      'no-console': 'off',
    },
  },
  {
    // Las pruebas usan ESM (vitest) y los globals del runner.
    files: ['tests/**/*.test.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
      },
    },
  },
  eslintConfigPrettier,
];
