interface ElectronShell {
	openPath(fullPath: string): Promise<string>;
}

interface Window {
	require(module: "electron"): { shell: ElectronShell };
}
