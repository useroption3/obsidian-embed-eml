/** Convert a byte array to a base64 string (chunked to avoid call-stack limits). */
export function uint8ToBase64(bytes: Uint8Array): string {
	let binary = "";
	const chunkSize = 0x8000;
	for (let i = 0; i < bytes.length; i += chunkSize) {
		const chunk = bytes.subarray(i, i + chunkSize);
		binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
	}
	return btoa(binary);
}

/** Build a `data:` URL from a MIME type and binary content. */
export function toDataUrl(mimeType: string, bytes: Uint8Array): string {
	const type = mimeType || "application/octet-stream";
	return `data:${type};base64,${uint8ToBase64(bytes)}`;
}

/** Human-readable byte size, e.g. "12.3 KB". */
export function formatBytes(bytes: number): string {
	if (!bytes) return "0 B";
	const units = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
	const size = bytes / Math.pow(1024, i);
	return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
