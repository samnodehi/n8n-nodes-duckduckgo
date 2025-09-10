module.exports = {
  root: true,
  env: { node: true, es2021: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2021,
  },
  plugins: ['n8n-nodes-base'],
  extends: ['plugin:n8n-nodes-base/recommended'],
  ignorePatterns: ['dist/**', 'node_modules/**', 'jest.config.js'],
};
/**
 * @type {import('@types/eslint').ESLint.ConfigData}
 */
module.exports = {
	extends: "./.eslintrc.js",

	overrides: [
		{
			files: ['package.json'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			rules: {
				'n8n-nodes-base/community-package-json-name-still-default': 'error',
			},
		},
	],
};
