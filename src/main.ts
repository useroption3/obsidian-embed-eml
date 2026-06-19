import { Plugin, TFile } from "obsidian";
import {
	DEFAULT_SETTINGS,
	EmbedEmlSettings,
	EmbedEmlSettingTab,
} from "./settings";
import { EmlEmbed } from "./embed";
import { EmlView, VIEW_TYPE_EML } from "./view";
import type { EmbedContext } from "./types";

const EML_EXTENSION = "eml";

export default class EmbedEmlPlugin extends Plugin {
	settings: EmbedEmlSettings;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.applyBodyDisplayState();
		this.register(() => {
			activeDocument.body.removeClass("eml-mode-scroll");
			activeDocument.body.style.removeProperty("--eml-max-body-height");
		});
		this.addSettingTab(new EmbedEmlSettingTab(this.app, this));

		// Inline embeds: `![[file.eml]]` (Reading view + hover popovers).
		this.registerEmlEmbed();

		// File view: open a .eml file in its own tab. Registering the extension
		// also enables the inline embed in Live Preview.
		this.registerView(VIEW_TYPE_EML, (leaf) => new EmlView(leaf, this));
		try {
			this.registerExtensions([EML_EXTENSION], VIEW_TYPE_EML);
		} catch (err) {
			console.error(
				"[embed-eml] Could not associate the .eml extension (another plugin may own it).",
				err
			);
		}
	}

	private registerEmlEmbed(): void {
		const registry = this.app.embedRegistry;
		if (!registry || typeof registry.registerExtension !== "function") {
			console.error(
				"[embed-eml] embedRegistry is unavailable; cannot register .eml embeds."
			);
			return;
		}

		registry.registerExtension(
			EML_EXTENSION,
			(ctx: EmbedContext, file: TFile) => new EmlEmbed(ctx, file, this)
		);

		// Remove the embed handler when the plugin unloads.
		this.register(() => {
			try {
				registry.unregisterExtension(EML_EXTENSION);
			} catch (err) {
				console.error("[embed-eml] Failed to unregister embed", err);
			}
		});
	}

	async loadSettings(): Promise<void> {
		const data = (await this.loadData()) as Partial<EmbedEmlSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data) as EmbedEmlSettings;
		// Migrate older configs that only stored a numeric maxBodyHeight.
		if (data && data.bodyDisplayMode === undefined) {
			this.settings.bodyDisplayMode =
				typeof data.maxBodyHeight === "number" && data.maxBodyHeight > 0
					? "scroll"
					: "full";
			if (this.settings.maxBodyHeight <= 0) {
				this.settings.maxBodyHeight = DEFAULT_SETTINGS.maxBodyHeight;
			}
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.applyBodyDisplayState();
	}

	/** Reflect the long-body display setting on <body> so embeds update live via CSS. */
	private applyBodyDisplayState(): void {
		activeDocument.body.toggleClass(
			"eml-mode-scroll",
			this.settings.bodyDisplayMode === "scroll"
		);
		activeDocument.body.style.setProperty(
			"--eml-max-body-height",
			`${this.settings.maxBodyHeight || 400}px`
		);
	}
}
