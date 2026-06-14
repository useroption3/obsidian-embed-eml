import { App, Component, TFile } from "obsidian";

// Obsidian exposes an (undocumented) embed registry that lets plugins render
// custom file extensions inside `![[...]]` embeds in both Reading view and
// Live Preview. We augment the public types so we can use it type-safely.
declare module "obsidian" {
	interface App {
		embedRegistry: EmbedRegistry;
	}
}

export interface EmbedContext {
	app: App;
	containerEl: HTMLElement;
	depth?: number;
	linktext?: string;
	showInline?: boolean;
	state?: unknown;
}

export interface EmbedComponent extends Component {
	loadFile(file?: TFile): void | Promise<void>;
}

export type EmbedCreator = (
	context: EmbedContext,
	file: TFile,
	subpath?: string
) => EmbedComponent;

export interface EmbedRegistry {
	registerExtension(extension: string, creator: EmbedCreator): void;
	unregisterExtension(extension: string): void;
	registerExtensions(extensions: string[], creator: EmbedCreator): void;
	unregisterExtensions(extensions: string[]): void;
}
