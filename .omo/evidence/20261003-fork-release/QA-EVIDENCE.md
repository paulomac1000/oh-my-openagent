# Fork release package QA — v5.0.0-beta.5-pm.1 candidate

## WHAT WAS TESTED

- `script/build-fork-release-package.ts --release-tag v5.0.0-beta.5-pm.1` on the
  `feat/fork-release-package` worktree (worktree SHA `875a1ec7`), real build (no
  --skip-build).
- Unit suite `script/fork-release-package.test.ts`: 6/6 (dirty rejection,
  tag/version mismatch, untracked secret rejection, legitimate tool filename
  acceptance, end-to-end identity/contents/checksums/determinism, checkout
  untouched).
- Extracted-package OpenCode smoke in an isolated HOME
  (plugin entry = `file://<extracted>/dist/index.js`, no real config touched).

## WHAT WAS OBSERVED

- Packager emitted `oh-my-openagent-fork-v5.0.0-beta.5-pm.1.tgz`
  (sha256 `06cb810c4ad6cfc1b504c67a4a74b39cd449679420f9054b3f9fe5946c45c44c`),
  release-manifest.json, SHA256SUMS; `optionalExternals: [@opentui/solid, sharp]`
  (dynamic-only, verified).
- Extracted payload: dist/ + node_modules/zod + assets/*.schema.json +
  package.json + README/LICENSE + release-manifest.json; no .omo, no
  .local-ignore, no secret-like files.
- Isolated-HOME `opencode run -m openai/gpt-6-luna`: plugin loaded — agent
  banner `Sisyphus - ultraworker · gpt-6-luna`, model replied `OK-PACKAGE`.
  Subsequent `/agent` HTTP queries raced plugin registration (7 native agents)
  — process-level `opencode run` proof used instead.
- `opencode run -m openai/gpt-6.1-sol`: request reached the provider and
  returned `Insufficient Balance` (typed provider-budget state; route exists).
  The same intermittent usage-limit burst was observed on the deployed host
  route the same day (recorded in private models.lock since #203).
- `opencode models` lists openai/gpt-5* catalog IDs — catalog visibility, not
  active routes; the isolated home has no user config, so effective agent
  defaults come from the generator (GPT-6 family; isolated-regeneration
  non-regression pinned upstream since #203).

## WHY IT IS ENOUGH

- Identity chain is mechanical: artifact sha256 in SHA256SUMS == recomputed
  digest; package manifest sha bound in the external manifest; entrypoint
  digest matches extracted bytes.
- The package is consumed exactly as deployed hosts will consume it
  (extract + file:// entrypoint) and proved a real end-to-end generation.
- Failure modes the packager guards (dirty tree, tag mismatch, secrets,
  unresolvable required imports) are unit-pinned.

## WHAT WAS OMITTED

- Raw probe outputs and logs are summarized; no credentials, tokens, or
  account identifiers are quoted anywhere in this evidence.
- Hosted Actions release build: NOT_OBSERVED (fork has no workflows);
  owner-authorized local canonical packager run = PASS (this document).
