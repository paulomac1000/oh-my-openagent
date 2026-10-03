#!/usr/bin/env bun
/**
 * Fork-owned release packager for paulomac1000/oh-my-openagent.
 *
 * Builds a deterministic, OpenCode-consumable plugin payload from the exact
 * reviewed source SHA and emits release assets (tgz + manifest + SHA256SUMS).
 * This is NOT the upstream npm publish path; upstream publish.yml gates on
 * code-yeongyu/oh-my-openagent and npm provenance, which this fork must not
 * exercise.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "..");
const FORK_REPO = "paulomac1000/oh-my-openagent";
const ARTIFACT_NAME_PREFIX = "oh-my-openagent-fork";
const IGNORED_UNTRACKED_PREFIXES = [".local-ignore/"];
const SECRET_FILE_PATTERNS = [
	/(^|\/)\.env($|\.)/i,
	/\.pem$/i,
	/id_rsa/i,
	/(^|\/)auth\.json$/i,
	/credential/i,
	/\.p12$/i,
	/\.key$/i,
	/\.token$/i,
	/(access|refresh|session|api|auth)[-_.]?token/i,
	/(^|[-_.])secrets?([-_.]|$)/i,
];
const SECRET_CONTENT_PATTERNS: RegExp[] = [
	/sk-(live|test)-[A-Za-z0-9]{16,}/,
	/ghp_[A-Za-z0-9]{30,}/,
	/xox[bpars]-[A-Za-z0-9-]{10,}/,
	/AKIA[0-9A-Z]{16}/,
	/(OPENAI|ANTHROPIC|GITHUB|ZAI)_API_KEY\s*=\s*["']?[A-Za-z0-9_-]{20,}/,
];
const BARE_IMPORT_EXCLUDE = /^(node:|bun:|@\/|\.|\.\.)/;
const TEXT_SUFFIXES = new Set([".js", ".mjs", ".cjs", ".ts", ".json", ".md", ".txt", ".schema.json"]);
const MAX_TEXT_SCAN_BYTES = 512 * 1024;

function fail(code: string, detail: string): never {
	console.error(`${code}: ${detail}`);
	process.exit(1);
}

let repoRoot = REPO_ROOT;

function git(args: string[], cwd = repoRoot): string {
	const result = spawnSync("git", args, { cwd, encoding: "utf8" });
	if (result.status !== 0) fail("GIT_FAILED", `${args.join(" ")}: ${result.stderr}`);
	return (result.stdout ?? "").trim();
}

function assertCleanTree(): void {
	const lines = git(["status", "--porcelain"]).split("\n").filter(Boolean);
	const dirty = lines.filter((line) => {
		const body = line.slice(3);
		if (!line.startsWith("?? ")) return true;
		return IGNORED_UNTRACKED_PREFIXES.some((prefix) => body.startsWith(prefix)) ? false : isSecretLikeName(body) ? false : true;
	});
	const secretUntracked = lines.filter((line) => line.startsWith("?? ") && isSecretLikeName(line.slice(3)));
	if (secretUntracked.length > 0) fail("SECRET_LIKE_FILE", secretUntracked.join("; "));
	if (dirty.length > 0) fail("DIRTY_CHECKOUT", dirty.join("; "));
}

function assertReleaseTag(tag: string, baseVersion: string): void {
	const expectedPrefix = `v${baseVersion}-pm.`;
	const suffix = tag.slice(expectedPrefix.length);
	if (!tag.startsWith(expectedPrefix) || !/^\d+$/.test(suffix)) {
		fail("TAG_VERSION_MISMATCH", `tag must be ${expectedPrefix}<N> for base version ${baseVersion}, got ${tag}`);
	}
}

function isSecretLikeName(name: string): boolean {
	return SECRET_FILE_PATTERNS.some((pattern) => pattern.test(name));
}

function scanStagedForSecrets(stagingRoot: string): void {
	const walk = (dir: string) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) {
				walk(full);
				continue;
			}
			if (isSecretLikeName(entry.name)) {
				fail("SECRET_LIKE_FILE", relative(stagingRoot, full));
			}
			if (!TEXT_SUFFIXES.has(entry.name.slice(entry.name.lastIndexOf(".")))) continue;
			const stats = statSync(full);
			if (stats.size > MAX_TEXT_SCAN_BYTES) continue;
			const text = readFileSync(full, "utf8");
			for (const pattern of SECRET_CONTENT_PATTERNS) {
				if (pattern.test(text)) fail("SECRET_LIKE_CONTENT", relative(stagingRoot, full));
			}
		}
	};
	walk(stagingRoot);
}

function collectBareImports(file: string): string[] {
	const text = readFileSync(file, "utf8");
	const imports = new Set<string>();
	for (const match of text.matchAll(/(?:from|import)\s*["']([^"']+)["']/g)) {
		const specifier = match[1];
		if (BARE_IMPORT_EXCLUDE.test(specifier)) continue;
		imports.add(specifier.split("/")[0].startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0]);
	}
	return [...imports];
}

function assertRuntimeImportsResolvable(stagingRoot: string): void {
	const missing = new Set<string>();
	const walk = (dir: string) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) {
				walk(full);
				continue;
			}
			if (!/\.(js|mjs|cjs)$/.test(entry.name)) continue;
			for (const specifier of collectBareImports(full)) {
				if (!existsSync(join(stagingRoot, "node_modules", specifier))) missing.add(specifier);
			}
		}
	};
	walk(join(stagingRoot, "dist"));
	if (missing.size > 0) fail("RUNTIME_IMPORT_UNRESOLVABLE", [...missing].join(", "));
}

const COPY_ALLOWLIST = [
	{ source: "package.json", optional: false },
	{ source: "README.md", optional: false },
	{ source: "LICENSE.md", optional: true },
	{ source: "assets", optional: true },
	{ source: "dist", optional: false },
	{ source: "node_modules/zod", optional: false },
];

function stagePayload(stagingRoot: string): void {
	for (const entry of COPY_ALLOWLIST) {
		const source = join(repoRoot, entry.source);
		if (!existsSync(source)) {
			if (entry.optional) continue;
			fail("PAYLOAD_SOURCE_MISSING", entry.source);
		}
		const target = join(stagingRoot, entry.source);
		mkdirSync(join(target, ".."), { recursive: true });
		cpSync(source, target, { recursive: true });
	}
}

function sha256File(path: string): string {
	return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function normalizeModes(dir: string): void {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			exec("chmod", ["755", full]);
			normalizeModes(full);
		} else {
			exec("chmod", ["644", full]);
		}
	}
}

function exec(command: string, args: string[], cwd = REPO_ROOT): string {
	const result = spawnSync(command, args, { cwd, encoding: "utf8" });
	if (result.status !== 0) fail(`${command.toUpperCase()}_FAILED`, `${args.join(" ")}: ${result.stderr}`);
	return result.stdout ?? "";
}

function main(): void {
	const args = process.argv.slice(2);
	let releaseTag = "";
	let outDir = join(REPO_ROOT, ".local-ignore", "fork-release");
	let skipBuild = false;
	let rootOverride = "";
	for (let index = 0; index < args.length; index += 1) {
		if (args[index] === "--release-tag") releaseTag = args[++index] ?? "";
		else if (args[index] === "--out-dir") outDir = resolve(args[++index] ?? "");
		else if (args[index] === "--skip-build") skipBuild = true;
		else if (args[index] === "--repo-root") rootOverride = resolve(args[++index] ?? "");
		else fail("UNKNOWN_ARGUMENT", args[index] ?? "");
	}
	if (!releaseTag) fail("MISSING_RELEASE_TAG", "--release-tag v<version>-pm<N> is required");
	if (rootOverride) repoRoot = rootOverride;

	assertCleanTree();
	const sourceSha = git(["rev-parse", "HEAD"]);
	const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
	const baseVersion = String(pkg.version);
	assertReleaseTag(releaseTag, baseVersion);

	if (!skipBuild) exec("bun", ["run", "build"]);
	if (!existsSync(join(repoRoot, "dist/index.js"))) fail("BUILD_OUTPUT_MISSING", "dist/index.js");

	const stagingRoot = join(outDir, ".staging", "package");
	rmSync(join(outDir, ".staging"), { recursive: true, force: true });
	mkdirSync(stagingRoot, { recursive: true });
	stagePayload(stagingRoot);
	scanStagedForSecrets(stagingRoot);
	assertRuntimeImportsResolvable(stagingRoot);

	const entrypointSha256 = sha256File(join(stagingRoot, "dist/index.js"));
	const manifest = {
		repository: FORK_REPO,
		sourceSha,
		releaseTag,
		basePackageVersion: baseVersion,
		buildToolchain: {
			bun: exec("bun", ["--version"]).trim(),
			node: exec("node", ["--version"]).trim(),
		},
		entrypoint: "dist/index.js",
		entrypointSha256,
		buildRecipe: "bun run build (bun build --target bun --format esm packages/omo-opencode/src/index.ts --external zod); payload = dist + node_modules/zod + assets/*.schema.json + package.json + README/LICENSE",
	};
	const manifestBytes = `${JSON.stringify(manifest, null, 2)}\n`;
	writeFileSync(join(stagingRoot, "release-manifest.json"), manifestBytes);

	normalizeModes(stagingRoot);
	const artifactPath = join(outDir, `${ARTIFACT_NAME_PREFIX}-${releaseTag}.tgz`);
	const tarPath = join(outDir, "package.tar");
	exec("tar", [
		"--sort=name", "--mtime=@0", "--owner=0", "--group=0", "--numeric-owner",
		"-cf", tarPath, "-C", join(outDir, ".staging"), "package",
	]);
	exec("gzip", ["-n", "-f", tarPath]);
	rmSync(tarPath, { force: true });
	renameSync(`${tarPath}.gz`, artifactPath);
	const artifactSha256 = sha256File(artifactPath);

	const externalManifest = {
		...manifest,
		artifactName: `${ARTIFACT_NAME_PREFIX}-${releaseTag}.tgz`,
		artifactSha256,
		packageManifestSha256: createHash("sha256").update(manifestBytes).digest("hex"),
	};
	writeFileSync(join(outDir, "release-manifest.json"), `${JSON.stringify(externalManifest, null, 2)}\n`);
	const manifestSha256 = createHash("sha256").update(readFileSync(join(outDir, "release-manifest.json"))).digest("hex");
	writeFileSync(
		join(outDir, "SHA256SUMS"),
		`${artifactSha256}  ${ARTIFACT_NAME_PREFIX}-${releaseTag}.tgz\n${manifestSha256}  release-manifest.json\n`,
	);
	rmSync(join(outDir, ".staging"), { recursive: true, force: true });
	console.log(`PACKAGED tag=${releaseTag} source=${sourceSha} artifact=${artifactPath} sha256=${artifactSha256}`);
}

main();
