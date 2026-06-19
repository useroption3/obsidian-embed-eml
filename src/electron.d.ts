declare module "electron" {
	interface Shell {
		openPath(fullPath: string): Promise<string>;
	}
	export const shell: Shell;
}
