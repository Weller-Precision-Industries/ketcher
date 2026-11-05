/** Prepares the local Ketcher merge transaction and its upstream receipt without updating remote refs. */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

export const BASE = "robotutor";
export const HEAD = "automation/ketcher-upstream-sync";
export const UPSTREAM = "https://github.com/epam/ketcher.git";

/** Reject branch names and expressions where an exact candidate commit is required. */
export function checkedSha(value) {
	if (!/^[a-f0-9]{40}$/.test(value)) throw new Error("Expected an exact 40-character commit SHA");
	return value;
}

/** Execute one bounded command with captured output and no shell interpolation. */
export function run(program, args, options = {}) {
	return execFileSync(program, args, {
		encoding: "utf8",
		timeout: 120_000,
		maxBuffer: 8 * 1024 * 1024,
		stdio: ["pipe", "pipe", "pipe"],
		...options,
	}).trim();
}

/** Prepare a history-preserving candidate in a clean disposable checkout without pushing it. */
export function prepareMerge(cwd, upstream = UPSTREAM) {
	const git = (...args) => run("git", ["-c", "core.hooksPath=/dev/null", ...args], { cwd });
	if (git("status", "--porcelain")) throw new Error("Sync requires a clean disposable checkout");
	git("config", "user.name", "robotutor-upstream[bot]");
	git("config", "user.email", "robotutor-upstream@users.noreply.github.com");
	git("fetch", "--no-tags", "origin", `+refs/heads/${BASE}:refs/remotes/origin/${BASE}`);
	git("fetch", "--no-tags", upstream, "+refs/heads/master:refs/remotes/epam/master");
	const baseSha = checkedSha(git("rev-parse", `origin/${BASE}`));
	const upstreamSha = checkedSha(git("rev-parse", "refs/remotes/epam/master"));
	const unchanged = git("rev-list", "--count", `${baseSha}..${upstreamSha}`) === "0";
	if (unchanged) return { changed: false, sha: baseSha, upstreamSha };

	const previous = git("ls-remote", "--heads", "origin", `refs/heads/${HEAD}`);
	if (previous) git("fetch", "--no-tags", "origin", `+refs/heads/${HEAD}:refs/remotes/origin/${HEAD}`);
	git("checkout", "--detach", previous ? `origin/${HEAD}` : baseSha);
	try {
		// Preserve both Robotutor and upstream history; never force-update a remote branch.
		git("merge", "--no-edit", baseSha);
		git("merge", "--no-edit", "--no-ff", upstreamSha);
	} catch (error) {
		const conflicts = git("diff", "--name-only", "--diff-filter=U");
		git("merge", "--abort");
		throw new Error(`Upstream merge stopped; no remote update. Conflicts: ${conflicts || error.message}`, {
			cause: error,
		});
	}
	writeFileSync(
		`${cwd}/.robotutor/upstream.json`,
		JSON.stringify(
			{
				repository: "epam/ketcher",
				branch: "master",
				sha: upstreamSha,
			},
			null,
			2,
		) + "\n",
	);
	git("add", ".robotutor/upstream.json");
	if (git("diff", "--cached", "--name-only")) git("commit", "-m", `build: record upstream ${upstreamSha}`);
	// GITHUB_TOKEN may not push workflow-file changes, and every one needs review.
	const workflowChanges = git("diff", "--name-only", baseSha, "HEAD", "--", ".github/workflows")
		.split("\n")
		.filter(Boolean);
	return { changed: true, sha: checkedSha(git("rev-parse", "HEAD")), upstreamSha, workflowChanges };
}
