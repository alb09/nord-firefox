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
| `scripts/release.mjs` | build → sign unlisted at AMO → append to `docs/updates.json` |
| `docs/updates.json` | update manifest Firefox polls |
| `docs/releases/` | signed xpis the feed points at |

`dist/`, `signed/`, and `web-ext-artifacts/` are build output and not tracked.

Pages publishes `docs/`, not the repo root. That keeps upstream's `manifest.json` at the root
where merges can find it, and stops GitHub serving a dark-only manifest carrying upstream's
add-on id. Nothing in the add-on references this layout — Firefox only ever fetches
`docs/updates.json`.

## Building

```sh
node scripts/build.mjs            # unsigned dist/nord-auto-<version>.xpi
node scripts/release.mjs          # sign at AMO and update the feed, then commit + push
```

The version is the fork's own, set as `version` in `config.json` (currently `1`); it does not
track upstream's, since this fork has its own identity and its own release history. Bump it to
publish again.

The build refuses to run if the two palettes cover different keys, naming the keys that
differ — one palette missing a key means Firefox silently falls back to a default colour.

`release.mjs` pins `web-ext` to an exact version (the `WEB_EXT_VERSION` constant). Leave it
pinned: the AMO credentials are in the environment during that call, so whatever version runs
can sign a theme under this add-on's id, and a Mozilla-signed theme passes Firefox's update
check and reaches everyone who has the add-on installed. Bump it deliberately, after reading
the changelog.

### After pushing

Check that the commit you pushed is the one Pages actually deployed:

```sh
gh api repos/alb09/nord-firefox/pages/builds/latest --jq '.commit, .status'
gh api repos/alb09/nord-firefox/deployments --jq '.[0].sha'
```

A successful build is not a successful deployment. GitHub sometimes reports `built` while the
site still serves an older commit, most visibly after changing the Pages source path, which
does not by itself trigger a rebuild. If the two SHAs disagree with your `HEAD`, push an empty
commit (`git commit --allow-empty`) to force the redeploy, then check again.

## Staying current with upstream

`git fetch upstream && git merge upstream/master` is all it takes. Upstream's `manifest.json`
is unmodified in this repo, so merges only touch upstream's own changes; our light palette
lives in `src/light.json` and never collides with it. When upstream adds or recolours a key,
the build will refuse until `src/light.json` covers it.

## License

CC BY 4.0, same as upstream. The dark palette is derived from
[dragonejt/nord-firefox](https://github.com/dragonejt/nord-firefox) by dragonejt; colors from the
[Nord palette](https://www.nordtheme.com/).