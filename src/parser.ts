import PostalMime, { Address, Mailbox } from "postal-mime";

export interface ParsedAttachment {
	filename: string | null;
	mimeType: string;
	size: number;
	content: Uint8Array;
	contentId: string | null;
	inline: boolean;
}

export interface ParsedEml {
	subject: string;
	from: string;
	to: string;
	cc: string;
	date: string;
	html: string | null;
	text: string | null;
	attachments: ParsedAttachment[];
}

function isMailbox(address: Address): address is Mailbox {
	return (address as Mailbox).address !== undefined;
}

/** Format a single address as `Name <addr>` (or a group as `Group: a, b`). */
function formatAddress(address: Address): string {
	if (isMailbox(address)) {
		const addr = (address.address || "").trim();
		const name = (address.name || "").trim();
		if (name && addr) return `${name} <${addr}>`;
		return name || addr;
	}
	const members = (address.group || []).map(formatAddress).join(", ");
	return address.name ? `${address.name}: ${members}` : members;
}

function formatAddressList(list?: Address[]): string {
	if (!list || list.length === 0) return "";
	return list.map(formatAddress).join(", ");
}

/** Normalize postal-mime's attachment content (buffer/view/string) to a Uint8Array. */
function toUint8Array(content: ArrayBuffer | Uint8Array | string): Uint8Array {
	if (content instanceof Uint8Array) return content;
	if (content instanceof ArrayBuffer) return new Uint8Array(content);
	return new TextEncoder().encode(content);
}

/** Parse a raw .eml buffer into a normalized, render-ready structure. */
export async function parseEml(data: ArrayBuffer): Promise<ParsedEml> {
	const email = await PostalMime.parse(data, { attachmentEncoding: "arraybuffer" });

	const attachments: ParsedAttachment[] = (email.attachments || []).map((a) => {
		const content = toUint8Array(a.content);
		return {
			filename: a.filename,
			mimeType: a.mimeType || "application/octet-stream",
			size: content.byteLength,
			content,
			contentId: a.contentId || null,
			inline: a.disposition === "inline",
		};
	});

	let date = "";
	if (email.date) {
		const d = new Date(email.date);
		date = isNaN(d.getTime()) ? email.date : d.toLocaleString();
	}

	return {
		subject: email.subject || "",
		from: email.from ? formatAddress(email.from) : "",
		to: formatAddressList(email.to),
		cc: formatAddressList(email.cc),
		date,
		html: email.html || null,
		text: email.text || null,
		attachments,
	};
}
