import { readFileSync } from "fs";
import { parseEml } from "../src/parser";

const buf = readFileSync(new URL("../samples/sample.eml", import.meta.url));
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

const parsed = await parseEml(ab as ArrayBuffer);
console.log("subject:", parsed.subject);
console.log("from   :", parsed.from);
console.log("to     :", parsed.to);
console.log("cc     :", parsed.cc);
console.log("date   :", parsed.date);
console.log("html?  :", parsed.html ? "yes" : "no", "| text?", parsed.text ? "yes" : "no");
console.log(
	"attachments:",
	parsed.attachments.map((a) => ({
		filename: a.filename,
		mime: a.mimeType,
		size: a.size,
		cid: a.contentId,
		inline: a.inline,
		isU8: a.content instanceof Uint8Array,
	}))
);
