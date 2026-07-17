import { arrayBufferToBase64, normalizePath, type Plugin } from "obsidian";

/**
 * Folder where attachments are staged before being handed to the OS. Derived
 * from the manifest so it follows a renamed config folder; `manifest.dir` is
 * optional in the API, so fall back to composing it from `configDir`.
 */
export function tmpDir(plugin: Plugin): string {
	const dir =
		plugin.manifest.dir ??
		`${plugin.app.vault.configDir}/plugins/${plugin.manifest.id}`;
	return normalizePath(`${dir}/tmp`);
}

/** Build a `data:` URL from a MIME type and binary content. */
export function toDataUrl(mimeType: string, bytes: Uint8Array): string {
	const type = mimeType || "application/octet-stream";
	// slice() detaches the view from any shared buffer before encoding.
	return `data:${type};base64,${arrayBufferToBase64(bytes.slice().buffer)}`;
}

/** Human-readable byte size, e.g. "12.3 KB". */
export function formatBytes(bytes: number): string {
	if (!bytes) return "0 B";
	const units = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
	const size = bytes / Math.pow(1024, i);
	return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
