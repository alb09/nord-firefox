#!/usr/bin/env node
// Build -> sign (AMO unlisted) -> copy into docs/releases/ -> update docs/updates.json.
// Exits early if that version is already in the feed. Commit + push to publish.
// Needs WEB_EXT_API_KEY / WEB_EXT_API_SECRET in the environment (never commit them).
import { readFileSync, writeFileSync, existsSync, readdirSync, copyFileSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(readFileSync(join(root, "config.json"), "utf8"));
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: "inherit", cwd: root, ...opts });

// The web-ext release that signed v1. Bump deliberately, after reading its changelog.
const WEB_EXT_VERSION = "10.7.0";

run("node", ["scripts/build.mjs"]);
const { version } = JSON.parse(readFileSync(join(root, "dist/manifest.json"), "utf8"));

// Everything Pages serves lives in docs/, which is the only publish root GitHub offers besides
// /. Keeping it separate lets the repo root hold upstream's manifest.json unmodified for clean
// merges — otherwise Pages would serve a dark-only manifest carrying upstream's add-on id.
// Firefox only ever fetches docs/updates.json, so its location is invisible to the add-on.
const docs = join(root, "docs");
const feedPath = join(docs, "updates.json");
const feed = existsSync(feedPath) ? JSON.parse(readFileSync(feedPath, "utf8")) : {};
feed.addons ??= {};
feed.addons[cfg.id] ??= { updates: [] };
const updates = feed.addons[cfg.id].updates;
if (updates.some((u) => u.version === version)) {
  console.log(`version ${version} already released; nothing to do`);
  process.exit(0);
}
// web-ext signs asynchronously; with a real approval timeout it waits and downloads the
// signed file itself. Snapshot signed/ first so we only ever pick this run's artefact.
// --adopt-signed <xpi> skips signing and publishes a file AMO already signed, which is how
// you recover when a run died after submitting but before the approval came back.
const signedDir = join(root, "signed");
const adopt = process.argv.indexOf("--adopt-signed");
let signed;
if (adopt !== -1) {
  signed = process.argv[adopt + 1];
  if (!signed) throw new Error("--adopt-signed needs the path to a signed xpi");
  console.log(`adopting already-signed ${signed} (no new submission)`);
} else {
  if (!process.env.WEB_EXT_API_KEY || !process.env.WEB_EXT_API_SECRET) {
    throw new Error("WEB_EXT_API_KEY / WEB_EXT_API_SECRET not set");
  }
  const before = new Set(existsSync(signedDir) ? readdirSync(signedDir) : []);
  // build.mjs leaves an unsigned xpi in dist/ for about:debugging; web-ext would bundle it
  // inside the signed one, so drop it before signing.
  for (const f of readdirSync(join(root, "dist")).filter((f) => f.endsWith(".xpi"))) {
    rmSync(join(root, "dist", f));
  }
  // web-ext is pinned exactly. Unpinned, this resolves whatever is newest on npm while the
  // AMO API credentials sit in the environment: whoever controls that package could sign a
  // theme under our add-on id, and a Mozilla-signed theme passes Firefox's update check and
  // reaches everyone who has it installed. Pinning does not defend against a compromise of
  // the registry account or this exact version's tarball; it removes the moving target.
  run("npx", ["--yes", `web-ext@${WEB_EXT_VERSION}`, "sign", "--channel=unlisted",
    "--source-dir=dist", "--artifacts-dir=signed", "--approval-timeout=30"]);
  const fresh = readdirSync(signedDir).filter((f) => f.endsWith(".xpi") && !before.has(f));
  if (fresh.length !== 1) {
    throw new Error(`expected exactly one newly signed xpi in signed/, found ${fresh.length}`);
  }
  signed = join(signedDir, fresh[0]);
}
// Whatever we picked has to actually be this add-on at this version, or the feed would
// point users at someone else's file.
const inside = JSON.parse(execFileSync("unzip", ["-p", signed, "manifest.json"], { encoding: "utf8" }));
if (inside.version !== version || inside.browser_specific_settings?.gecko?.id !== cfg.id) {
  throw new Error(`${signed} holds ${inside.browser_specific_settings?.gecko?.id} ${inside.version}, expected ${cfg.id} ${version}`);
}
if (!inside.theme?.colors || !inside.dark_theme?.colors) {
  throw new Error(`${signed} has no theme/dark_theme pair`);
}

mkdirSync(join(docs, "releases"), { recursive: true });
const name = `nord-auto-${version}.xpi`;
copyFileSync(signed, join(docs, "releases", name));

updates.push({ version, update_link: `${cfg.updateBaseUrl}/releases/${name}` });
writeFileSync(feedPath, JSON.stringify(feed, null, 2) + "\n");
console.log(`released ${name}; commit docs/ and push to publish`);
