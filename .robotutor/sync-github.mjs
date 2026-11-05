/** Owns fork workflow policy, review proposals and trusted build requests through a supplied command runner. */
import { BASE, HEAD } from "./sync-local.mjs";

export const REPOSITORY = "Weller-Precision-Industries/ketcher";
export const OWN_WORKFLOWS = [".github/workflows/robotutor-sync.yml", ".github/workflows/robotutor-build.yml"];

/** Bind the GitHub adapter to the CLI runner; constructing it performs no requests. */
export function createGithubSync(run) {
	const api = (endpoint, method = "GET", body) =>
		JSON.parse(
			run("gh", ["api", endpoint, "--method", method, ...(body ? ["--input", "-"] : [])], {
				input: body ? JSON.stringify(body) : undefined,
			}) || "null",
		);

	function prepare() {
		const metadata = api(`repos/${REPOSITORY}`);
		if (!metadata.fork || metadata.parent?.full_name !== "epam/ketcher" || metadata.default_branch !== BASE) {
			throw new Error("Fork parent/default branch mismatch; refusing to update");
		}
		// Upstream may add workflows at any merge; only the Robotutor ones may run here.
		for (let page = 1; ; page++) {
			const { workflows } = api(`repos/${REPOSITORY}/actions/workflows?per_page=100&page=${page}`);
			for (const workflow of workflows) {
				// GitHub-managed dynamic/ workflows (Dependabot, CodeQL default setup) reject the API (HTTP 422).
				if (
					!OWN_WORKFLOWS.includes(workflow.path) &&
					!workflow.path.startsWith("dynamic/") &&
					workflow.state === "active"
				) {
					api(`repos/${REPOSITORY}/actions/workflows/${workflow.id}/disable`, "PUT");
					console.log(`Disabled inherited workflow ${workflow.path}`);
				}
			}
			if (workflows.length < 100) break;
		}
	}

	function propose(result) {
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
			return (
				`Could not open the review PR (${String(error.stderr || error.message).trim()}). ` +
				`Open it from https://github.com/${REPOSITORY}/compare/${BASE}...${HEAD}; allow Actions to create PRs ` +
				"in the organization or add ROBOTUTOR_SYNC_TOKEN."
			);
		}
		return "";
	}

	function dispatch(result) {
		// GITHUB_TOKEN push/PR events need not start unattended CI. Dispatch explicitly.
		api(`repos/${REPOSITORY}/actions/workflows/robotutor-build.yml/dispatches`, "POST", {
			ref: BASE,
			inputs: { candidate_sha: result.sha, upstream_sha: result.upstreamSha },
		});
	}

	return { prepare, propose, dispatch };
}
