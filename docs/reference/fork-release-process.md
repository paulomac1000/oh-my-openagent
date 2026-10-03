# Fork Release Process

How `paulomac1000/oh-my-openagent` publishes its own OpenCode plugin runtime
packages. This fork does not publish the upstream npm names; the upstream
`publish.yml` remains gated on `code-yeongyu/oh-my-openagent` and performs npm
provenance publishing that this fork must never exercise.

## Release identity

```text
reviewed exact source SHA
-> bun run build
-> packaged OpenCode plugin payload (dist + node_modules/zod + assets/*.schema.json + package.json + README/LICENSE)
-> release-manifest.json (source SHA, tag, base version, toolchain, entrypoint digest)
-> SHA256SUMS
-> fork-owned tag  v<base-version>-pm.<N>
-> GitHub Release with attached package + manifest + checksums
```

Tags use the fork-owned `-pm.<N>` suffix on the inherited upstream base
version (for example `v5.0.0-beta.5-pm.1`). A tag that disagrees with the
packaged `package.json` version is rejected by the packager
(`TAG_VERSION_MISMATCH`). Published tags are immutable: a defective release
gets a new `pm.N`, never a moved tag.

## Packager

```bash
bun run script/build-fork-release-package.ts --release-tag v5.0.0-beta.5-pm.1 --out-dir <dir>
```

The packager fails closed on: dirty checkout (`DIRTY_CHECKOUT`; untracked
paths under `.local-ignore/` are the only tolerated dirt), untracked
secret-like files (`SECRET_LIKE_FILE`), secret-like staged content
(`SECRET_LIKE_CONTENT`), tag/version disagreement, build output missing, and
shipped runtime imports that do not resolve inside the payload
(`RUNTIME_IMPORT_UNRESOLVABLE`; the only runtime external of `dist/index.js`
is `zod`, which is shipped under `node_modules/zod`).

Deterministic identity: tar entries are sorted with fixed mtime/owner and
gzipped without a timestamp, so two runs from the same tree produce identical
`artifactSha256` values. The in-package `release-manifest.json` binds source
SHA, tag, base version, toolchain, and entrypoint digest;
`release-manifest.json` (release asset) adds `artifactSha256` and
`packageManifestSha256`. Consumers verify the SHA256SUMS entries, the payload
manifest digest, and the entrypoint digest before loading.

## Deployment consumers

Extract the package to a versioned directory (never overwrite the previous
one in place), verify digests, and point the OpenCode `plugin` entry at
`file://<extracted>/dist/index.js`. Rollback is a plugin-entry flip back to
the previous versioned directory plus the previous effective config; no
source rebuild is involved.
