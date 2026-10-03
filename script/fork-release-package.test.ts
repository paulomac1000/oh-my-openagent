import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "..");
const PACKAGER = join(REPO_ROOT, "script", "build-fork-release-package.ts");

function git(args: string[], cwd = REPO_ROOT): string {
	return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

const tmpRoots: string[] = [];
function makeTmp(prefix: string): string {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	tmpRoots.push(dir);
	return dir;
}
afterAll(() => {
	for (const dir of tmpRoots) rmSync(dir, { recursive: true, force: true });
});

function makeMiniRepo(): string {
	const root = makeTmp("fork-release-repo-");
	mkdirSync(join(root, "dist/cli"), { recursive: true });
	mkdirSync(join(root, "assets"), { recursive: true });
	mkdirSync(join(root, "node_modules/zod"), { recursive: true });
	execFileSync("git", ["init", "-q"], { cwd: root });
	writeFileSync(join(root, "package.json"), JSON.stringify({ name: "oh-my-openagent", version: "5.0.0-beta.5", bin: { "oh-my-openagent": "bin/oh-my-opencode.js" }, type: "module" }, null, 2));
	writeFileSync(join(root, "dist/index.js"), 'import { z } from "zod";\nexport const plugin = { zod: z.string() };\n');
	writeFileSync(join(root, "dist/cli/index.js"), 'import { z } from "zod";\nconsole.log("cli");\n');
	writeFileSync(join(root, "assets/omo.schema.json"), JSON.stringify({ type: "object" }));
	writeFileSync(join(root, "README.md"), "# oh-my-openagent fork release\n");
	writeFileSync(join(root, "node_modules/zod/package.json"), JSON.stringify({ name: "zod", version: "4.0.0" }));
	writeFileSync(join(root, "node_modules/zod/index.js"), "export const z = {};\n");
	mkdirSync(join(root, "packages/lsp-daemon/dist"), { recursive: true });
	writeFileSync(join(root, "packages/lsp-daemon/dist/cli.js"), "#!/usr/bin/env node\n");
	writeFileSync(join(root, "packages/lsp-daemon/package.json"), JSON.stringify({ name: "@oh-my-opencode/lsp-daemon", version: "5.0.0-beta.5" }));
	mkdirSync(join(root, "packages/lsp-tools-mcp/dist"), { recursive: true });
	writeFileSync(join(root, "packages/lsp-tools-mcp/dist/index.js"), "export {};\n");
	writeFileSync(join(root, "packages/lsp-tools-mcp/package.json"), JSON.stringify({ name: "@oh-my-opencode/lsp-tools-mcp", version: "5.0.0-beta.5" }));
	return root;
}

function runPackager(repoRoot: string, args: string[]): { stdout: string; stderr: string; code: number } {
	try {
		const stdout = execFileSync("bun", ["run", PACKAGER, ...args], {
			cwd: repoRoot,
			encoding: "utf8",
			env: { ...process.env },
			stdio: ["ignore", "pipe", "pipe"],
		});
		return { stdout, stderr: "", code: 0 };
	} catch (error) {
		const err = error as { stdout?: string; stderr?: string; status?: number };
		return { stdout: err.stdout ?? "", stderr: err.stderr ?? String(error), code: err.status ?? 1 };
	}
}

describe("fork release packager", () => {
	test("rejects dirty checkout", () => {
		const repo = makeMiniRepo();
		writeFileSync(join(repo, "dist/index.js"), 'import { z } from "zod";\nexport const plugin = { dirty: true };\n');
		git(["add", "-A"], repo);
		git(["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-m", "base"], repo);
		writeFileSync(join(repo, "dist/index.js"), 'export const dirty = 1;\n');
		const result = runPackager(repo, ["--repo-root", repo, "--release-tag", "v5.0.0-beta.5-pm.1", "--out-dir", makeTmp("out-"), "--skip-build"]);
		expect(result.code).not.toBe(0);
		expect(result.stderr).toContain("DIRTY_CHECKOUT");
	});

	test("rejects tag that disagrees with package version", () => {
		const repo = makeMiniRepo();
		git(["add", "-A"], repo);
		git(["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-m", "base"], repo);
		const result = runPackager(repo, ["--repo-root", repo, "--release-tag", "v9.9.9-pm.1", "--out-dir", makeTmp("out-"), "--skip-build"]);
		expect(result.code).not.toBe(0);
		expect(result.stderr).toContain("TAG_VERSION_MISMATCH");
	});

	test("legitimate tool filenames are not secret-like", () => {
		const repo = makeMiniRepo();
		mkdirSync(join(repo, "dist/tools"), { recursive: true });
		writeFileSync(join(repo, "dist/tools/token-limiter.d.ts"), "export declare const limit: number;\n");
		git(["add", "-A"], repo);
		git(["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "base"], repo);
		const result = runPackager(repo, ["--repo-root", repo, "--release-tag", "v5.0.0-beta.5-pm.1", "--out-dir", makeTmp("out-"), "--skip-build"]);
		expect(result.code).toBe(0);
	});

	test("rejects untracked secret-like files outside ignore paths", () => {
		const repo = makeMiniRepo();
		git(["add", "-A"], repo);
		git(["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "base"], repo);
		writeFileSync(join(repo, ".env"), "SECRET=1\n");
		const result = runPackager(repo, ["--repo-root", repo, "--release-tag", "v5.0.0-beta.5-pm.1", "--out-dir", makeTmp("out-"), "--skip-build"]);
		expect(result.code).not.toBe(0);
		expect(result.stderr).toContain("SECRET_LIKE_FILE");
	});

	test("end-to-end package: identity, contents, checksums, determinism", () => {
		const repo = makeMiniRepo();
		git(["add", "-A"], repo);
		git(["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "base"], repo);
		const outDir = makeTmp("out-");
		const result = runPackager(repo, ["--repo-root", repo, "--release-tag", "v5.0.0-beta.5-pm.1", "--out-dir", outDir, "--skip-build"]);
		expect(result.stderr).toBe("");
		expect(result.code).toBe(0);

		const artifactPath = join(outDir, "oh-my-openagent-fork-v5.0.0-beta.5-pm.1.tgz");
		expect(existsSync(artifactPath)).toBe(true);
		const manifest = JSON.parse(readFileSync(join(outDir, "release-manifest.json"), "utf8"));
		expect(manifest.repository).toBe("paulomac1000/oh-my-openagent");
		expect(manifest.sourceSha).toBe(git(["rev-parse", "HEAD"], repo));
		expect(manifest.releaseTag).toBe("v5.0.0-beta.5-pm.1");
		expect(manifest.basePackageVersion).toBe("5.0.0-beta.5");
		expect(manifest.entrypoint).toBe("dist/index.js");
		expect(manifest.buildToolchain.bun.length).toBeGreaterThan(0);
		expect(manifest.buildToolchain.node.length).toBeGreaterThan(0);

		const sums = readFileSync(join(outDir, "SHA256SUMS"), "utf8");
		const artifactDigest = createHash("sha256").update(readFileSync(artifactPath)).digest("hex");
		expect(sums).toContain(artifactDigest);

		const extractDir = makeTmp("extract-");
		execFileSync("tar", ["-xzf", artifactPath, "-C", extractDir]);
		const payloadRoot = join(extractDir, "package");
		expect(readFileSync(join(payloadRoot, "dist/index.js"), "utf8")).toBe(readFileSync(join(repo, "dist/index.js"), "utf8"));
		expect(existsSync(join(payloadRoot, "node_modules/zod/index.js"))).toBe(true);
		expect(existsSync(join(payloadRoot, "assets/omo.schema.json"))).toBe(true);
		expect(existsSync(join(payloadRoot, "packages/lsp-daemon/dist/cli.js"))).toBe(true);
		expect(existsSync(join(payloadRoot, "packages/lsp-tools-mcp/dist/index.js"))).toBe(true);
		expect(existsSync(join(payloadRoot, "packages/lsp-daemon/node_modules"))).toBe(false);
		expect(existsSync(join(payloadRoot, ".omo"))).toBe(false);
		expect(existsSync(join(payloadRoot, ".local-ignore"))).toBe(false);
		expect(existsSync(join(payloadRoot, ".env"))).toBe(false);

		const manifestInPackage = JSON.parse(readFileSync(join(payloadRoot, "release-manifest.json"), "utf8"));
		expect(manifestInPackage.sourceSha).toBe(manifest.sourceSha);
		expect(manifestInPackage.entrypointSha256).toBe(
			createHash("sha256").update(readFileSync(join(payloadRoot, "dist/index.js"))).digest("hex"),
		);
		expect(manifest.packageManifestSha256).toBe(
			createHash("sha256").update(readFileSync(join(payloadRoot, "release-manifest.json"))).digest("hex"),
		);
		expect(manifest.artifactSha256).toBe(artifactDigest);

		const outDirSecond = makeTmp("out2-");
		const second = runPackager(repo, ["--repo-root", repo, "--release-tag", "v5.0.0-beta.5-pm.1", "--out-dir", outDirSecond, "--skip-build"]);
		expect(second.code).toBe(0);
		const secondDigest = createHash("sha256").update(readFileSync(join(outDirSecond, "oh-my-openagent-fork-v5.0.0-beta.5-pm.1.tgz"))).digest("hex");
		expect(secondDigest).toBe(artifactDigest);
	});

	test("package generation leaves the source checkout untouched", () => {
		const repo = makeMiniRepo();
		git(["add", "-A"], repo);
		git(["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-m", "base"], repo);
		const before = git(["status", "--porcelain"], repo);
		runPackager(repo, ["--repo-root", repo, "--release-tag", "v5.0.0-beta.5-pm.1", "--out-dir", makeTmp("out-"), "--skip-build"]);
		const after = git(["status", "--porcelain"], repo);
		expect(after).toBe(before);
	});
});
