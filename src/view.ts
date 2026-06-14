import { FileView, TFile, WorkspaceLeaf } from "obsidian";
import type EmbedEmlPlugin from "./main";
import { parseEml } from "./parser";
import { EmlRenderer } from "./renderer";

export const VIEW_TYPE_EML = "eml-view";

/**
 * Full-tab view for opening a `.eml` file directly. Registering this view also
 * marks `.eml` as a recognized file type, which is what lets Live Preview render
 * the inline `![[file.eml]]` embed (Reading view works from the embed registry
 * alone, but Live Preview only embeds known file types).
 */
export class EmlView extends FileView {
	allowNoFile = false;

	constructor(leaf: WorkspaceLeaf, private plugin: EmbedEmlPlugin) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_EML;
	}

	getIcon(): string {
		return "mail";
	}

	getDisplayText(): string {
		return this.file?.basename ?? "Email";
	}

	async onLoadFile(file: TFile): Promise<void> {
		this.contentEl.empty();
		const container = this.contentEl.createDiv({ cls: "eml-view" });
		try {
			const data = await this.app.vault.readBinary(file);
			const renderer = new EmlRenderer(this, container, this.plugin);
			renderer.render(await parseEml(data));
		} catch (err) {
			EmlRenderer.renderError(container, file.path, err);
		}
	}

	async onUnloadFile(): Promise<void> {
		this.contentEl.empty();
	}
}
