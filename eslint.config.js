/**
 * ESLint flat config (ESLint 9+). Replaces the legacy .eslintrc.js,
 * .eslintrc.prepublish.js, and .eslintignore.
 *
 * The eslint-plugin-n8n-nodes-base presets are still authored in the legacy
 * "extends" style, so they are loaded through FlatCompat. Parser, parserOptions,
 * globals (formerly `env`), and the per-path overrides are otherwise unchanged.
 *
 * The previously prepublish-only rule
 * `n8n-nodes-base/community-package-json-name-still-default` is now always an
 * error (the package is correctly named, so it always passes).
 */
const { FlatCompat } = require('@eslint/eslintrc');

const compat = new FlatCompat({ baseDirectory: __dirname });

module.exports = [
	{
		ignores: ['dist/**', 'node_modules/**', '**/*.js', '**/*.mjs', '**/*.cjs'],
	},
	...compat.config({
		env: {
			browser: true,
			es6: true,
			node: true,
		},

		parser: '@typescript-eslint/parser',

		parserOptions: {
			project: ['./tsconfig.json'],
			sourceType: 'module',
			extraFileExtensions: ['.json'],
		},

		overrides: [
			{
				files: ['package.json'],
				plugins: ['eslint-plugin-n8n-nodes-base'],
				extends: ['plugin:n8n-nodes-base/community'],
				rules: {
					'n8n-nodes-base/community-package-json-name-still-default': 'error',
				},
			},
			{
				files: ['./credentials/**/*.ts'],
				plugins: ['eslint-plugin-n8n-nodes-base'],
				extends: ['plugin:n8n-nodes-base/credentials'],
				rules: {
					'n8n-nodes-base/cred-class-field-documentation-url-missing': 'off',
					'n8n-nodes-base/cred-class-field-documentation-url-miscased': 'off',
				},
			},
			{
				files: ['./nodes/**/*.ts'],
				plugins: ['eslint-plugin-n8n-nodes-base'],
				extends: ['plugin:n8n-nodes-base/nodes'],
				rules: {
					'n8n-nodes-base/node-execute-block-missing-continue-on-fail': 'off',
					'n8n-nodes-base/node-resource-description-filename-against-convention': 'off',
					'n8n-nodes-base/node-param-fixed-collection-type-unsorted-items': 'off',
					// This rule does not recognise non-literal (enum / expression)
					// defaults such as `default: DuckDuckGoOperation.Search`, so it
					// false-positives and its autofix inserts duplicate `default`
					// keys. This was the reason the file was previously excluded from
					// linting via .eslintignore; turning the rule off is the honest
					// equivalent now that the file is linted.
					'n8n-nodes-base/node-param-default-missing': 'off',
					// The node groups collection options logically (e.g. the page-content
					// options are kept together) rather than alphabetically. Consistent
					// with node-param-fixed-collection-type-unsorted-items being off above.
					'n8n-nodes-base/node-param-collection-type-unsorted-items': 'off',
				},
			},
		],
	}),
];
