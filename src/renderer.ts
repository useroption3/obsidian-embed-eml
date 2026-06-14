import { Component, Notice, Platform, setIcon } from "obsidian";
import type EmbedEmlPlugin from "./main";
import { ParsedAttachment, ParsedEml } from "./parser";
import { formatBytes, toDataUrl } from "./util";

/** Baseline styles injected into the sandboxed iframe so emails render legibly. */
const IFRAME_BASE_CSS = `
html, body { margin: 0; padding: 0; }
body {
	background: #ffffff;
	color: #1a1a1a;
	font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
	font-size: 14px;
	line-height: 1.5;
	padding: 12px;
	word-wrap: break-word;
	overflow-wrap: break-word;
}
img { max-width: 100%; height: auto; }
table { max-width: 100%; }
a { color: #2563eb; }
img[data-eml-blocked] {
	min-width: 24px;
	min-height: 24px;
	border: 1px dashed #c0c0c0;
}
`;

/**
 * Renders a parsed email into a container element. Shared by the inline embed
 * (`![[file.eml]]`) and the full-tab file view so both look identical.
 *
 * `owner` is the host Component used for DOM-event cleanup.
 */
export class EmlRenderer {
	private parsed: ParsedEml | null = null;
	private remoteImagesAllowed = false;

	constructor(
		private owner: Component,
		private containerEl: HTMLElement,
		private plugin: EmbedEmlPlugin
	) {}

	render(parsed: ParsedEml): void {
		this.parsed = parsed;
		this.draw();
	}

	private draw(): void {
		if (!this.parsed) return;
		const eml = this.parsed;
		this.containerEl.empty();
		const root = this.containerEl.createDiv({ cls: "eml-embed" });

		// --- Header ---
		const header = root.createDiv({ cls: "eml-header" });
		const titleRow = header.createDiv({ cls: "eml-title-row" });
		setIcon(titleRow.createSpan({ cls: "eml-icon" }), "mail");
		titleRow.createDiv({
			cls: "eml-subject",
			text: eml.subject || "(No subject)",
		});

		const meta = header.createDiv({ cls: "eml-meta" });
		this.addField(meta, "From", eml.from);
		this.addField(meta, "To", eml.to);
		this.addField(meta, "Cc", eml.cc);
		this.addField(meta, "Date", eml.date);

		// --- Body ---
		const body = root.createDiv({ cls: "eml-body" });
		this.renderBody(body);

		// --- Attachments ---
		this.renderAttachments(root, eml.attachments);
	}

	private addField(parent: HTMLElement, label: string, value: string): void {
		if (!value) return;
		const row = parent.createDiv({ cls: "eml-field" });
		row.createSpan({ cls: "eml-field-label", text: label });
		row.createSpan({ cls: "eml-field-value", text: value });
	}

	private renderBody(body: HTMLElement): void {
		const eml = this.parsed;
		if (!eml) return;
		const hasHtml = !!eml.html && eml.html.trim().length > 0;
		const hasText = !!eml.text && eml.text.trim().length > 0;

		if (this.plugin.settings.renderHtml && hasHtml) {
			this.renderHtmlBody(body, eml.html as string);
		} else if (hasText) {
			this.renderTextBody(body, eml.text as string);
		} else if (hasHtml) {
			// HTML rendering disabled but no plain-text alternative exists.
			this.renderHtmlBody(body, eml.html as string);
		} else {
			body.createDiv({ cls: "eml-empty", text: "(No message body)" });
		}
	}

	private renderTextBody(body: HTMLElement, text: string): void {
		// Height capping for long bodies is handled in CSS (scoped to embeds via
		// the `eml-mode-scroll` body class) so the setting updates without a re-render.
		body.createEl("pre", { cls: "eml-text", text });
	}

	private renderHtmlBody(body: HTMLElement, html: string): void {
		const { srcdoc, blockedCount } = this.prepareHtml(html);

		if (blockedCount > 0 && !this.remoteImagesAllowed) {
			const banner = body.createDiv({ cls: "eml-remote-banner" });
			banner.createSpan({
				text: `Remote images blocked (${blockedCount}) for your privacy.`,
			});
			const btn = banner.createEl("button", {
				cls: "eml-remote-btn",
				text: "Load images",
			});
			this.owner.registerDomEvent(btn, "click", () => {
				this.remoteImagesAllowed = true;
				this.draw();
			});
		}

		const wrap = body.createDiv({ cls: "eml-body-scroll" });

		const iframe = wrap.createEl("iframe", { cls: "eml-iframe" });
		iframe.setAttribute("title", "Email content");
		// No `allow-scripts`: scripts in the email never execute. `allow-popups`
		// lets links open externally; `allow-same-origin` lets us measure height.
		iframe.setAttribute(
			"sandbox",
			"allow-same-origin allow-popups allow-popups-to-escape-sandbox"
		);
		iframe.setAttribute("referrerpolicy", "no-referrer");
		iframe.srcdoc = srcdoc;

		this.owner.registerDomEvent(iframe, "load", () => {
			this.resizeIframe(iframe);
			try {
				const doc = iframe.contentDocument;
				if (!doc) return;
				// Images can change layout height after the initial load event.
				doc.querySelectorAll("img").forEach((img) => {
					img.addEventListener("load", () => this.resizeIframe(iframe));
					img.addEventListener("error", () =>
						this.resizeIframe(iframe)
					);
				});
			} catch {
				/* contentDocument may be inaccessible; height falls back to CSS. */
			}
		});
	}

	private resizeIframe(iframe: HTMLIFrameElement): void {
		try {
			const doc = iframe.contentDocument;
			if (!doc || !doc.body) return;
			const height = Math.max(
				doc.body.scrollHeight,
				doc.documentElement.scrollHeight
			);
			iframe.style.height = `${height + 4}px`;
		} catch {
			/* Cross-origin access can throw; keep the CSS fallback height. */
		}
	}

	/**
	 * Turn raw email HTML into iframe-safe `srcdoc`:
	 * - inline `cid:` images become `data:` URLs from their attachments;
	 * - remote images are stripped when blocking is enabled;
	 * - `<script>` is removed and links are forced to open in a new window.
	 */
	private prepareHtml(html: string): { srcdoc: string; blockedCount: number } {
		const eml = this.parsed;
		const doc = new DOMParser().parseFromString(html, "text/html");
		let blockedCount = 0;

		const cidMap = new Map<string, ParsedAttachment>();
		for (const att of eml?.attachments ?? []) {
			if (att.contentId) {
				cidMap.set(att.contentId.replace(/[<>]/g, ""), att);
			}
		}

		const blockRemote =
			this.plugin.settings.blockRemoteImages && !this.remoteImagesAllowed;

		doc.querySelectorAll("img").forEach((img) => {
			const src = img.getAttribute("src") || "";
			if (/^cid:/i.test(src)) {
				const att = cidMap.get(src.slice(4).replace(/[<>]/g, ""));
				if (att) {
					img.setAttribute("src", toDataUrl(att.mimeType, att.content));
				} else {
					img.removeAttribute("src");
				}
			} else if (/^https?:/i.test(src) && blockRemote) {
				img.removeAttribute("src");
				img.setAttribute("data-eml-blocked", "1");
				blockedCount++;
			}
		});

		doc.querySelectorAll("script").forEach((el) => el.remove());

		let head = doc.head;
		if (!head) {
			head = doc.createElement("head");
			doc.documentElement.prepend(head);
		}
		const base = doc.createElement("base");
		base.setAttribute("target", "_blank");
		head.prepend(base);

		const style = doc.createElement("style");
		style.textContent = IFRAME_BASE_CSS;
		head.appendChild(style);

		return {
			srcdoc: "<!DOCTYPE html>" + doc.documentElement.outerHTML,
			blockedCount,
		};
	}

	private renderAttachments(
		root: HTMLElement,
		attachments: ParsedAttachment[]
	): void {
		// Inline images are already shown in the body, so don't list them.
		const visible = attachments.filter((a) => !a.inline);
		if (visible.length === 0) return;

		const wrap = root.createDiv({ cls: "eml-attachments" });
		const head = wrap.createDiv({ cls: "eml-attachments-head" });
		setIcon(head.createSpan({ cls: "eml-attach-icon" }), "paperclip");
		head.createSpan({
			text: `${visible.length} attachment${visible.length > 1 ? "s" : ""}`,
		});

		const list = wrap.createDiv({ cls: "eml-attachment-list" });
		for (const att of visible) {
			const name = att.filename || "attachment";
			const chip = list.createDiv({ cls: "eml-attachment" });
			chip.setAttribute("title", `Double-click to open ${name}`);
			setIcon(chip.createSpan({ cls: "eml-attachment-icon" }), "file");
			chip.createSpan({ cls: "eml-attachment-name", text: name });
			chip.createSpan({
				cls: "eml-attachment-size",
				text: formatBytes(att.size),
			});
			this.owner.registerDomEvent(chip, "dblclick", () =>
				this.openAttachment(att)
			);
		}
	}

	/**
	 * Open an attachment in the OS default app by writing it to a temp file and
	 * handing it to the shell (desktop only). On mobile, fall back to download.
	 */
	private async openAttachment(att: ParsedAttachment): Promise<void> {
		if (!Platform.isDesktopApp) {
			this.downloadAttachment(att);
			return;
		}
		try {
			const os = require("os");
			const fs = require("fs");
			const path = require("path");
			const { shell } = require("electron");

			// Keep the real name/extension so the OS picks the right app.
			const safeName = (att.filename || "attachment").replace(
				/[\\/:*?"<>|]/g,
				"_"
			);
			const dir = fs.mkdtempSync(path.join(os.tmpdir(), "obsidian-eml-"));
			const filePath = path.join(dir, safeName);
			fs.writeFileSync(filePath, Buffer.from(att.content));
			// Mark the temp copy read-only so editors (Word, Excel, …) open it in
			// read-only mode — it's a throwaway copy, so edits would be lost anyway.
			try {
				fs.chmodSync(filePath, 0o444);
			} catch {
				/* best-effort; the file still opens without the read-only bit */
			}

			const error: string = await shell.openPath(filePath);
			if (error) new Notice(`Couldn't open attachment: ${error}`);
		} catch (err) {
			new Notice(
				`Couldn't open attachment: ${
					err instanceof Error ? err.message : String(err)
				}`
			);
			console.error("[embed-eml] openAttachment failed", err);
		}
	}

	private downloadAttachment(att: ParsedAttachment): void {
		// `.slice()` yields a fresh ArrayBuffer-backed copy (a valid BlobPart).
		const blob = new Blob([att.content.slice()], {
			type: att.mimeType || "application/octet-stream",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = att.filename || "attachment";
		document.body.appendChild(a);
		a.click();
		a.remove();
		window.setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	/** Render a friendly error box into `container`. */
	static renderError(
		container: HTMLElement,
		path: string | undefined,
		err: unknown
	): void {
		container.empty();
		const box = container.createDiv({ cls: "eml-error" });
		setIcon(box.createSpan({ cls: "eml-error-icon" }), "alert-triangle");
		const content = box.createDiv({ cls: "eml-error-content" });
		content.createDiv({
			cls: "eml-error-title",
			text: "Failed to render email",
		});
		content.createDiv({
			cls: "eml-error-msg",
			text: err instanceof Error ? err.message : String(err),
		});
		console.error(`[embed-eml] Failed to render ${path ?? ""}`, err);
	}
}
