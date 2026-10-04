#!/usr/bin/env node
// Builds dist/manifest.json (+ dist/nord-auto-<version>.xpi) from this repo's dark palette
// (upstream's manifest.json, kept as-is at the root) and src/light.json.
// Zero dependencies, no network; needs node >= 18 and `zip`.
//
// This is a real fork, so upstream's manifest.json is a file we merge like any other and
// `dark_theme` is whatever it currently says. `theme` is our light palette, and each side
// declares its colour_scheme, so Firefox's Light / Dark / System setting picks the right one.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(readFileSync(join(root, "config.json"), "utf8"));
const light = JSON.parse(readFileSync(join(root, "src/light.json"), "utf8"));
const up = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));

// Parity gate. The dark palette owns the key set; we owe a light value for each key. If the
// two disagree, one of them silently falls back to a Firefox default, which is the exact
// failure the light palette exists to prevent — so refuse to build and name the keys.
const darkKeys = Object.keys(up.theme.colors);
const missing = darkKeys.filter((k) => !(k in light.colors));
const extra = Object.keys(light.colors).filter((k) => !darkKeys.includes(k));
if (missing.length || extra.length) {
  if (missing.length) console.error(`light palette is missing: ${missing.join(", ")}`);
  if (extra.length) console.error(`light palette has keys the dark one does not: ${extra.join(", ")}`);
  console.error("fix src/light.json, then rebuild");
  process.exit(1);
}

// Upstream version + our light revision -> "<upstream major.minor.patch>.<lightRevision>".
// Bump lightRevision to publish again after editing the light palette. Upstream's version is
// normalised to three parts first so a four-part upstream release cannot push us past AMO's
// four-part limit.
const parts = String(up.version).split(".").map((n) => parseInt(n, 10));
if (parts.some((n) => !Number.isInteger(n))) throw new Error(`upstream version is not numeric: ${up.version}`);
const upstream3 = parts.slice(0, 3).concat([0, 0, 0]).slice(0, 3);
const version = `${upstream3.join(".")}.${cfg.lightRevision}`;
if (version.split(".").length > 4) throw new Error(`assembled version is not valid for AMO: ${version}`);

const manifest = {
  manifest_version: up.manifest_version,
  version,
  name: cfg.name,
  description: cfg.description,
  browser_specific_settings: {
    gecko: { id: cfg.id, update_url: `${cfg.updateBaseUrl}/updates.json` },
  },
  theme: light,
  dark_theme: up.theme,
};

const dist = join(root, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
writeFileSync(join(dist, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
execFileSync("zip", ["-q", "-X", `nord-auto-${version}.xpi`, "manifest.json"], { cwd: dist });
console.log(`built dist/nord-auto-${version}.xpi`);
console.log(`  dark  manifest.json (${up.version}), ${darkKeys.length} keys`);
console.log(`  light src/light.json revision ${cfg.lightRevision}, ${Object.keys(light.colors).length} keys`);
console.log("  toggle: theme = light scheme, dark_theme = dark scheme, Light/Dark/System follows the system");