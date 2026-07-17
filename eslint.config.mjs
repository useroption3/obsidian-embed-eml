import obsidianmd from "eslint-plugin-obsidianmd";

export default [
	{ ignores: ["main.js", "*.mjs", "node_modules/", "samples/", "test/"] },
	...obsidianmd.configs.recommended,
	{
		languageOptions: {
			parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
		},
	},
];
