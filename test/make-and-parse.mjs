// Dev-only: generate a realistic sample .eml and verify postal-mime parses it
// the way src/parser.ts expects. Run: node test/make-and-parse.mjs
import { writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import PostalMime from "../node_modules/postal-mime/src/postal-mime.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// 1x1 transparent PNG
const pngB64 =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const attB64 = Buffer.from("hello attachment!\n", "utf8").toString("base64");
const subject =
	"=?UTF-8?B?" +
	Buffer.from("こんにちは: メール埋め込みテスト", "utf8").toString("base64") +
	"?=";

const eml = [
	"From: Alice Example <alice@example.com>",
	"To: Bob <bob@example.com>",
	"Cc: Carol <carol@example.com>",
	`Subject: ${subject}`,
	"Date: Sat, 14 Jun 2025 10:30:00 +0900",
	"MIME-Version: 1.0",
	'Content-Type: multipart/related; boundary="REL"',
	"",
	"--REL",
	'Content-Type: multipart/alternative; boundary="ALT"',
	"",
	"--ALT",
	"Content-Type: text/plain; charset=UTF-8",
	"Content-Transfer-Encoding: 8bit",
	"",
	"これはテキスト版の本文です。",
	"Hello in plain text.",
	"",
	"--ALT",
	"Content-Type: text/html; charset=UTF-8",
	"Content-Transfer-Encoding: 8bit",
	"",
	"<html><body><h1>Hello</h1>",
	"<p>これは<strong>HTML</strong>版の本文です。</p>",
	'<p>Inline: <img src="cid:logo123" alt="logo"></p>',
	'<p>Remote: <img src="https://example.com/tracker.png" alt="remote"></p>',
	"</body></html>",
	"",
	"--ALT--",
	"",
	"--REL",
	"Content-Type: image/png",
	"Content-Transfer-Encoding: base64",
	"Content-ID: <logo123>",
	'Content-Disposition: inline; filename="logo.png"',
	"",
	pngB64,
	"",
	"--REL",
	"Content-Type: text/plain; charset=UTF-8",
	"Content-Transfer-Encoding: base64",
	'Content-Disposition: attachment; filename="readme.txt"',
	"",
	attB64,
	"",
	"--REL--",
	"",
].join("\r\n");

mkdirSync(join(root, "samples"), { recursive: true });
writeFileSync(join(root, "samples", "sample.eml"), eml);
console.log("Wrote samples/sample.eml\n");

const email = await PostalMime.parse(eml, { attachmentEncoding: "arraybuffer" });

console.log("subject :", JSON.stringify(email.subject));
console.log("from    :", JSON.stringify(email.from));
console.log("to      :", JSON.stringify(email.to));
console.log("cc      :", JSON.stringify(email.cc));
console.log("date    :", email.date);
console.log("hasHtml :", !!email.html, "| hasText:", !!email.text);
console.log("html head:", (email.html || "").slice(0, 80).replace(/\n/g, " "));
console.log("attachments:");
for (const a of email.attachments) {
	const len =
		a.content instanceof ArrayBuffer
			? a.content.byteLength
			: a.content?.byteLength ?? a.content?.length;
	console.log("  -", {
		filename: a.filename,
		mimeType: a.mimeType,
		disposition: a.disposition,
		contentId: a.contentId,
		isArrayBuffer: a.content instanceof ArrayBuffer,
		size: len,
	});
}
