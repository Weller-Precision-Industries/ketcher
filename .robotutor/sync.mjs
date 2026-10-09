import { execFileSync } from "node:child_process";
import { writeFileSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const REPOSITORY = "Weller-Precision-Industries/ketcher";
export const BASE = "robotutor";
export const HEAD = "automation/ketcher-upstream-sync";
export const UPSTREAM = "https://github.com/epam/ketcher.git";
export const OWN_WORKFLOWS = [".github/workflows/robotutor-sync.yml", ".github/workflows/robotutor-build.yml"];

export function checkedSha(value) {
	if (!/^[a-f0-9]{40}$/.test(value)) throw new Error("Expected an exact 40-character commit SHA");
	return value;
}

export function run(program, args, options = {}) {
	return execFileSync(program, args, {
		encoding: "utf8",
		timeout: 120_000,
		maxBuffer: 8 * 1024 * 1024,
		stdio: ["pipe", "pipe", "pipe"],
		...options,
	}).trim();
}

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

export function main() {
	if (process.env.GITHUB_REPOSITORY !== REPOSITORY) throw new Error(`Run only in ${REPOSITORY}`);
	const api = (endpoint, method = "GET", body) =>
		JSON.parse(
			run("gh", ["api", endpoint, "--method", method, ...(body ? ["--input", "-"] : [])], {
				input: body ? JSON.stringify(body) : undefined,
			}) || "null",
		);
	const metadata = api(`repos/${REPOSITORY}`);
	if (!metadata.fork || metadata.parent?.full_name !== "epam/ketcher" || metadata.default_branch !== BASE) {
		throw new Error("Fork parent/default branch mismatch; refusing to update");
	}
	// Upstream may add workflows at any merge; only the Robotutor ones may run here.
	for (let page = 1; ; page++) {
		const { workflows } = api(`repos/${REPOSITORY}/actions/workflows?per_page=100&page=${page}`);
		for (const workflow of workflows) {
			if (!OWN_WORKFLOWS.includes(workflow.path) && workflow.state === "active") {
				api(`repos/${REPOSITORY}/actions/workflows/${workflow.id}/disable`, "PUT");
				console.log(`Disabled inherited workflow ${workflow.path}`);
			}
		}
		if (workflows.length < 100) break;
	}
	const result = prepareMerge(process.cwd());
	let proposalError = "";
	if (
		result.changed &&
		result.workflowChanges.length &&
		process.env.GITHUB_ACTIONS === "true" &&
		process.env.ROBOTUTOR_SYNC_TOKEN_PRESENT !== "true"
	) {
		throw new Error(
			`Upstream changed ${result.workflowChanges.join(", ")}. GITHUB_TOKEN cannot push workflow ` +
				"files: add the ROBOTUTOR_SYNC_TOKEN secret (fine-grained token for this repository with contents, " +
				"pull requests and workflows write) or run .robotutor/sync.mjs locally with an authorized gh.",
		);
	}
	if (result.changed) {
		run("git", ["-c", "core.hooksPath=/dev/null", "push", "origin", `HEAD:refs/heads/${HEAD}`]);
		const pulls = api(`repos/${REPOSITORY}/pulls?state=open&base=${BASE}&head=Weller-Precision-Industries:${HEAD}`);
		const body =
			`Upstream epam/ketcher@${result.upstreamSha}; candidate ${result.sha}.\n\n` +
			"Preserves Robotutor history. Do not merge without checking reset/preload/KET/assistance regressions.\n" +
			"The trusted default-branch build is explicitly dispatched; a bot-created PR is not a CI result.\n" +
			"Review dependency and workflow changes. No automatic merge or production deployment." +
			(result.workflowChanges.length
				? `\n\n**Upstream workflow changes to review:** ${result.workflowChanges.map((path) => `\`${path}\``).join(", ")}. ` +
					"Inherited workflows are disabled on every sync, but review them before merging."
				: "");
		const data = { title: "build: integrate upstream Ketcher", body };
		try {
			const pr = pulls[0]
				? api(`repos/${REPOSITORY}/pulls/${pulls[0].number}`, "PATCH", data)
				: api(`repos/${REPOSITORY}/pulls`, "POST", { ...data, base: BASE, head: HEAD });
			console.log(`Update PR: ${pr.html_url}`);
		} catch (error) {
			// The branch is pushed; do not hide that nobody was asked to review it.
			proposalError =
				`Could not open the review PR (${String(error.stderr || error.message).trim()}). ` +
				`Open it from https://github.com/${REPOSITORY}/compare/${BASE}...${HEAD}; allow Actions to create PRs ` +
				"in the organization or add ROBOTUTOR_SYNC_TOKEN.";
		}
	}
	// GITHUB_TOKEN push/PR events need not start unattended CI. Dispatch explicitly.
	api(`repos/${REPOSITORY}/actions/workflows/robotutor-build.yml/dispatches`, "POST", {
		ref: BASE,
		inputs: { candidate_sha: result.sha, upstream_sha: result.upstreamSha },
	});
	const summary =
		`Checked upstream ${result.upstreamSha}; candidate ${result.sha}; changes=${result.changed}.\n` +
		"Build requested, NOT yet passed. No automatic merge/publication.\n";
	if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + proposalError);
	console.log(summary);
	if (proposalError) throw new Error(proposalError);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	try {
		main();
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
