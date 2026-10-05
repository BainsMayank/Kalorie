const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  globalIgnores(['dist/*', 'drizzle/*', 'data/*', 'coverage/*', '.claude/*', '.expo/*']),
  expoConfig,
  // Must come last: turns off ESLint rules that Prettier handles.
  prettierConfig,
]);
