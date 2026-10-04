# Nord Auto

A fork of [dragonejt/nord-firefox](https://github.com/dragonejt/nord-firefox) that adds the
light half of the Nord palette. Upstream ships dark only; this keeps upstream's dark palette
exactly as it is and adds a light one, so the theme follows Firefox's Light / Dark / System
appearance setting.

## How the toggle works

Firefox's appearance setting (Light / Dark / System) chooses between the two palettes a theme
ships: `theme` is used for the light scheme, `dark_theme` for the dark one, and **System**
follows the OS. Both declare `properties.color_scheme`, so menus and built-in pages follow the
active variant instead of staying dark. There is no code in the add-on — it is a static manifest.

## Layout

| path | what it is |
|---|---|
| `manifest.json` | upstream's file, unchanged. Its `theme` is the dark palette. |
| `src/light.json` | our light palette, one value per dark-palette key |
| `config.json` | add-on id, name, version inputs, update URL |
| `scripts/build.mjs` | generates `dist/manifest.json` + `.xpi` from the two palettes. No network. |
| `scripts/release.mjs` | build → sign unlisted at AMO → append to `updates.json` |
| `updates.json` | update manifest Firefox polls |
| `releases/` | signed xpis the feed points at |

`dist/`, `signed/`, and `web-ext-artifacts/` are build output and not tracked.

## Building

```sh
node scripts/build.mjs            # unsigned dist/nord-auto-<version>.xpi
node scripts/release.mjs          # sign at AMO and update the feed, then commit + push
```

The version is always `<upstream major.minor.patch>.<lightRevision>` (currently `3.0.0.1`):
upstream's version is normalised to three parts first, so a four-part upstream release cannot
push the add-on past AMO's four-part limit. Bump `lightRevision` in `config.json` to publish
again after editing the light palette.

The build refuses to run if the two palettes cover different keys, naming the keys that
differ — one palette missing a key means Firefox silently falls back to a default colour.

## Staying current with upstream

`git fetch upstream && git merge upstream/master` is all it takes. Upstream's `manifest.json`
is unmodified in this repo, so merges only touch upstream's own changes; our light palette
lives in `src/light.json` and never collides with it. When upstream adds or recolours a key,
the build will refuse until `src/light.json` covers it.

## License

CC BY 4.0, same as upstream. The dark palette is derived from
[dragonejt/nord-firefox](https://github.com/dragonejt/nord-firefox) by dragonejt; colors from the
[Nord palette](https://www.nordtheme.com/).