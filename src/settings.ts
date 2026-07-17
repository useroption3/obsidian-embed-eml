import {
	App,
	PluginSettingTab,
	Setting,
	type SettingDefinitionItem,
} from "obsidian";
import type EmbedEmlPlugin from "./main";

/** How a long message body is displayed in an inline embed. */
export type BodyDisplayMode = "full" | "scroll";

export interface EmbedEmlSettings {
	/** Render the HTML body when available; otherwise always show plain text. */
	renderHtml: boolean;
	/** Block remote images/trackers until the user opts in per embed. */
	blockRemoteImages: boolean;
	/** "full" shows the whole body; "scroll" caps it at maxBodyHeight. */
	bodyDisplayMode: BodyDisplayMode;
	/** Height (px) the body scrolls within when bodyDisplayMode is "scroll". */
	maxBodyHeight: number;
}

export const DEFAULT_SETTINGS: EmbedEmlSettings = {
	renderHtml: true,
	blockRemoteImages: true,
	bodyDisplayMode: "full",
	maxBodyHeight: 400,
};

export class EmbedEmlSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: EmbedEmlPlugin) {
		super(app, plugin);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: "Render HTML body",
				desc: "Show the HTML version of emails when available. Disable to always show the plain-text version.",
				control: { type: "toggle", key: "renderHtml" },
			},
			{
				name: "Block remote images",
				desc: "Prevent emails from loading remote images and tracking pixels until you choose to load them.",
				control: { type: "toggle", key: "blockRemoteImages" },
			},
			{
				name: "Long message body",
				desc: "How to display an email whose body is very tall.",
				control: {
					type: "dropdown",
					key: "bodyDisplayMode",
					options: {
						full: "Show in full",
						scroll: "Scroll within a fixed height",
					},
				},
			},
			{
				name: "Body height",
				desc: "Maximum height in pixels before the body scrolls.",
				visible: () =>
					this.plugin.settings.bodyDisplayMode === "scroll",
				control: {
					type: "number",
					key: "maxBodyHeight",
					min: 50,
					placeholder: String(DEFAULT_SETTINGS.maxBodyHeight),
					defaultValue: DEFAULT_SETTINGS.maxBodyHeight,
				},
			},
		];
	}

	getControlValue(key: string): unknown {
		return this.plugin.settings[key as keyof EmbedEmlSettings];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		Object.assign(this.plugin.settings, { [key]: value });
		await this.plugin.saveSettings();
		this.refreshDomState();
	}

	/** Fallback for Obsidian < 1.13.0, which ignores getSettingDefinitions(). */
	display(): void {
		this.render();
	}

	private render(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Render HTML body")
			.setDesc(
				"Show the HTML version of emails when available. Disable to always show the plain-text version."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.renderHtml)
					.onChange(async (value) => {
						this.plugin.settings.renderHtml = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Block remote images")
			.setDesc(
				"Prevent emails from loading remote images and tracking pixels until you choose to load them."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.blockRemoteImages)
					.onChange(async (value) => {
						this.plugin.settings.blockRemoteImages = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Long message body")
			.setDesc("How to display an email whose body is very tall.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("full", "Show in full")
					.addOption("scroll", "Scroll within a fixed height")
					.setValue(this.plugin.settings.bodyDisplayMode)
					.onChange(async (value) => {
						this.plugin.settings.bodyDisplayMode =
							value as BodyDisplayMode;
						await this.plugin.saveSettings();
						this.render();
					})
			);

		if (this.plugin.settings.bodyDisplayMode === "scroll") {
			new Setting(containerEl)
				.setName("Body height")
				.setDesc("Maximum height in pixels before the body scrolls.")
				.addText((text) =>
					text
						.setPlaceholder(String(DEFAULT_SETTINGS.maxBodyHeight))
						.setValue(String(this.plugin.settings.maxBodyHeight))
						.onChange(async (value) => {
							const n = parseInt(value, 10);
							this.plugin.settings.maxBodyHeight =
								isNaN(n) || n < 50
									? DEFAULT_SETTINGS.maxBodyHeight
									: n;
							await this.plugin.saveSettings();
						})
				);
		}
	}
}
