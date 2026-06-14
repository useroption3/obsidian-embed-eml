import { Component, TFile } from "obsidian";
import type EmbedEmlPlugin from "./main";
import type { EmbedComponent, EmbedContext } from "./types";
import { parseEml } from "./parser";
import { EmlRenderer } from "./renderer";

/** Renders an inline `![[file.eml]]` embed. */
export class EmlEmbed extends Component implements EmbedComponent {
	private readonly containerEl: HTMLElement;
	private readonly renderer: EmlRenderer;
	private loadPromise: Promise<void> | null = null;

	constructor(
		ctx: EmbedContext,
		private file: TFile,
		private plugin: EmbedEmlPlugin
	) {
		super();
		this.containerEl = ctx.containerEl;
		this.renderer = new EmlRenderer(this, this.containerEl, this.plugin);
	}

	onload(): void {
		this.containerEl.addClass("eml-embed-container");
		void this.loadFile();
	}

	onunload(): void {
		this.containerEl.empty();
		this.containerEl.removeClass("eml-embed-container");
	}

	/** Obsidian's embed contract. Cached so onload + an external call parse once. */
	loadFile(): Promise<void> {
		if (!this.loadPromise) {
			this.loadPromise = this.doLoad();
		}
		return this.loadPromise;
	}

	private async doLoad(): Promise<void> {
		try {
			const data = await this.plugin.app.vault.readBinary(this.file);
			this.renderer.render(await parseEml(data));
		} catch (err) {
			EmlRenderer.renderError(this.containerEl, this.file?.path, err);
		}
	}
}
