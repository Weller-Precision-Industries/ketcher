/** Composes local Ketcher merge preparation, GitHub review/build requests and the CLI outcome report. */
import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createGithubSync, REPOSITORY } from "./sync-github.mjs";
import { HEAD, prepareMerge, run } from "./sync-local.mjs";

// Preserve the installed entrypoint's imports for existing lifecycle consumers.
export { OWN_WORKFLOWS, REPOSITORY } from "./sync-github.mjs";
export { BASE, checkedSha, HEAD, prepareMerge, run, UPSTREAM } from "./sync-local.mjs";

/** Run the guarded sync lifecycle and report a requested build without implying qualification. */
export function main() {
	if (process.env.GITHUB_REPOSITORY !== REPOSITORY) throw new Error(`Run only in ${REPOSITORY}`);
	const github = createGithubSync(run);
	github.prepare();
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
		proposalError = github.propose(result);
	}
	github.dispatch(result);
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
