import { readFileSync, writeFileSync } from "fs";

const targetVersion = process.env.npm_package_version;

// read minAppVersion from manifest.json and bump version to target version
let manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t"));

// update versions.json with target version and minAppVersion from manifest.json
let versions = JSON.parse(readFileSync("versions.json", "utf8"));
versions[targetVersion] = minAppVersion;
writeFileSync("versions.json", JSON.stringify(versions, null, "\t"));

// stamp the version into the styles.css header. GitHub keys attestations by file
// digest, so an unchanged styles.css keeps serving the previous release's
// attestation and the Obsidian plugin review reports it as unverifiable.
let styles = readFileSync("styles.css", "utf8");
writeFileSync(
	"styles.css",
	styles.replace(/^\/\* =====.*? ===== \*\//, `/* ===== Embed EML ${targetVersion} ===== */`),
);
