/**
 * Characterizes the sync CLI at its process, filesystem and reporting boundaries without running commands.
 * The same suite protects the installed fork copy; unexpected commands fail rather than reaching GitHub or Git.
 */
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import test from "node:test";
import { URL } from "node:url";

import { main } from "./sync.mjs";

const repository = "Weller-Precision-Industries/ketcher";
const endpoint = `repos/${repository}`;
const baseSha = "a".repeat(40);
const upstreamSha = "b".repeat(40);
const candidateSha = "c".repeat(40);
const proposalHead = "automation/ketcher-upstream-sync";
const pullsPath = `${endpoint}/pulls?state=open&base=robotutor&head=Weller-Precision-Industries:${proposalHead}`;
const dispatchPath = `${endpoint}/actions/workflows/robotutor-build.yml/dispatches`;

function fixture(t, options = {}) {
	const events = [];
	const environment = {
		GITHUB_REPOSITORY: repository,
		GITHUB_ACTIONS: "false",
		ROBOTUTOR_SYNC_TOKEN_PRESENT: "false",
		GITHUB_STEP_SUMMARY: "/stub/summary",
		...options.env,
	};
	const previous = Object.fromEntries(Object.keys(environment).map((key) => [key, process.env[key]]));
	Object.assign(process.env, environment);
	t.after(() => {
		for (const [key, value] of Object.entries(previous)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
		t.mock.restoreAll();
		syncBuiltinESMExports();
	});
	t.mock.method(console, "log", (message) => events.push({ kind: "log", message }));
	t.mock.method(fs, "writeFileSync", (path, content) => events.push({ kind: "write", path, content }));
	t.mock.method(fs, "appendFileSync", (path, content) => events.push({ kind: "summary", path, content }));
	t.mock.method(childProcess, "execFileSync", (program, args, commandOptions) => {
		if (program === "gh") {
			assert.equal(args[0], "api");
			assert.equal(args[2], "--method");
			const [, path, , method] = args;
			const input = commandOptions.input === undefined ? undefined : JSON.parse(commandOptions.input);
			assert.deepEqual(args.slice(4), input === undefined ? [] : ["--input", "-"]);
			events.push({ kind: "api", path, method, input });
			if (path === options.failPath) throw Object.assign(new Error("command failed"), { stderr: "HTTP 403 denied" });
			if (path === endpoint)
				return JSON.stringify(
					options.metadata ?? { fork: true, parent: { full_name: "epam/ketcher" }, default_branch: "robotutor" },
				);
			if (path.startsWith(`${endpoint}/actions/workflows?`)) {
				const page = Number(new URL(`https://example.invalid/${path}`).searchParams.get("page"));
				return JSON.stringify({ workflows: options.pages?.[page - 1] ?? [] });
			}
			if (path.endsWith("/disable") || path === dispatchPath) return "";
			if (path === pullsPath) return JSON.stringify(options.pulls ?? []);
			if (path === `${endpoint}/pulls` || path === `${endpoint}/pulls/18`)
				return JSON.stringify({ html_url: "https://example.invalid/review/18" });
			assert.fail(`Unexpected API: ${method} ${path}`);
		}
		assert.equal(program, "git", "Only explicitly stubbed commands may run");
		assert.deepEqual(args.slice(0, 2), ["-c", "core.hooksPath=/dev/null"]);
		const command = args.slice(2).join(" ");
		events.push({ kind: "git", command });
		if (command === options.failGit) throw new Error("git failed");
		if (command === "status --porcelain") return options.dirty ? "?? personal.txt" : "";
		if (command === "rev-parse origin/robotutor") return baseSha;
		if (command === "rev-parse refs/remotes/epam/master") return upstreamSha;
		if (command === "rev-parse HEAD") return candidateSha;
		if (command === `rev-list --count ${baseSha}..${upstreamSha}`) return options.unchanged ? "0" : "1";
		if (command === "diff --cached --name-only") return ".robotutor/upstream.json";
		if (command === `diff --name-only ${baseSha} HEAD -- .github/workflows`)
			return (options.workflowChanges ?? []).join("\n");
		if (/^(config |fetch |ls-remote |checkout |merge |add |commit |push )/.test(command)) return "";
		assert.fail(`Unexpected Git command: ${command}`);
	});
	syncBuiltinESMExports();
	return events;
}

const apiCalls = (events) => events.filter((event) => event.kind === "api");
const reported = (events) => events.filter((event) => event.kind === "summary" || event.kind === "log");

test("wrong execution repository refuses before any command or report", (t) => {
	const events = fixture(t, { env: { GITHUB_REPOSITORY: "epam/ketcher" } });
	assert.throws(main, /Run only in Weller-Precision-Industries\/ketcher/);
	assert.deepEqual(events, []);
});

for (const metadata of [
	{ fork: false, parent: { full_name: "epam/ketcher" }, default_branch: "robotutor" },
	{ fork: true, parent: { full_name: "other/ketcher" }, default_branch: "robotutor" },
	{ fork: true, parent: { full_name: "epam/ketcher" }, default_branch: "main" },
])
	test(`invalid fork metadata refuses before workflow or Git activity: ${JSON.stringify(metadata)}`, (t) => {
		const events = fixture(t, { metadata });
		assert.throws(main, /Fork parent\/default branch mismatch/);
		assert.deepEqual(events, [{ kind: "api", path: endpoint, method: "GET", input: undefined }]);
	});

test("workflow pagination disables only active inherited workflows before preparing the merge", (t) => {
	const page = Array.from({ length: 100 }, (_, id) => ({ id, path: `dynamic/managed/${id}`, state: "active" }));
	page[0] = { id: 1, path: ".github/workflows/upstream.yml", state: "active" };
	page[1] = { id: 2, path: ".github/workflows/robotutor-sync.yml", state: "active" };
	page[2] = { id: 3, path: ".github/workflows/robotutor-build.yml", state: "disabled_manually" };
	page[3] = { id: 4, path: ".github/workflows/disabled.yml", state: "disabled_inactivity" };
	const events = fixture(t, {
		unchanged: true,
		pages: [page, [{ id: 101, path: ".github/workflows/new.yml", state: "active" }]],
	});
	main();
	assert.deepEqual(
		apiCalls(events).map(({ path, method }) => [path, method]),
		[
			[endpoint, "GET"],
			[`${endpoint}/actions/workflows?per_page=100&page=1`, "GET"],
			[`${endpoint}/actions/workflows/1/disable`, "PUT"],
			[`${endpoint}/actions/workflows?per_page=100&page=2`, "GET"],
			[`${endpoint}/actions/workflows/101/disable`, "PUT"],
			[dispatchPath, "POST"],
		],
	);
	assert.ok(
		events.findIndex((event) => event.kind === "git") >
			events.findIndex((event) => event.path?.endsWith("101/disable")),
	);
});

test("unchanged upstream dispatches the base commit without push or proposal and then reports", (t) => {
	const events = fixture(t, { unchanged: true });
	main();
	assert.deepEqual(apiCalls(events).at(-1), {
		kind: "api",
		path: dispatchPath,
		method: "POST",
		input: { ref: "robotutor", inputs: { candidate_sha: baseSha, upstream_sha: upstreamSha } },
	});
	assert.equal(
		events.some((event) => event.command?.startsWith("push ") || event.path?.includes("/pulls")),
		false,
	);
	assert.deepEqual(
		reported(events).map((event) => event.kind),
		["summary", "log"],
	);
	assert.match(reported(events)[0].content, /changes=false\.[\s\S]*Build requested, NOT yet passed/);
});

test("changed candidate pushes before creating a review PR, dispatches, then reports", (t) => {
	const events = fixture(t);
	main();
	const pushIndex = events.findIndex((event) => event.command?.startsWith("push "));
	assert.equal(events[pushIndex].command, `push origin HEAD:refs/heads/${proposalHead}`);
	assert.equal(events[pushIndex + 1].path, pullsPath);
	const proposal = apiCalls(events).find((event) => event.method === "POST" && event.path.endsWith("/pulls"));
	assert.deepEqual(
		{ ...proposal.input, body: undefined },
		{ title: "build: integrate upstream Ketcher", body: undefined, base: "robotutor", head: proposalHead },
	);
	assert.match(proposal.input.body, /Preserves Robotutor history[\s\S]*No automatic merge or production deployment\.$/);
	assert.deepEqual(apiCalls(events).at(-1).input, {
		ref: "robotutor",
		inputs: { candidate_sha: candidateSha, upstream_sha: upstreamSha },
	});
	assert.deepEqual(
		events.slice(-2).map((event) => event.kind),
		["summary", "log"],
	);
});

test("existing proposal is updated and includes exact upstream workflow review paths", (t) => {
	const events = fixture(t, {
		pulls: [{ number: 18 }],
		workflowChanges: [".github/workflows/new.yml"],
		env: { GITHUB_ACTIONS: "true", ROBOTUTOR_SYNC_TOKEN_PRESENT: "true" },
	});
	main();
	const proposal = apiCalls(events).find((event) => event.method === "PATCH");
	assert.equal(proposal.path, `${endpoint}/pulls/18`);
	assert.match(proposal.input.body, /\*\*Upstream workflow changes to review:\*\* `\.github\/workflows\/new.yml`/);
	assert.equal(proposal.input.base, undefined);
});

test("workflow changes without the Actions token stop after local preparation and before push", (t) => {
	const events = fixture(t, { workflowChanges: [".github/workflows/new.yml"], env: { GITHUB_ACTIONS: "true" } });
	assert.throws(main, /GITHUB_TOKEN cannot push workflow files/);
	assert.equal(
		events.some((event) => event.kind === "write"),
		true,
	);
	assert.equal(
		events.some((event) => event.command?.startsWith("push ") || event.path === dispatchPath),
		false,
	);
	assert.deepEqual(reported(events), []);
});

test("proposal failure still dispatches and reports the compare fallback before throwing", (t) => {
	const events = fixture(t, { failPath: `${endpoint}/pulls` });
	assert.throws(main, /Could not open the review PR \(HTTP 403 denied\)/);
	assert.equal(apiCalls(events).at(-1).path, dispatchPath);
	const summary = events.find((event) => event.kind === "summary");
	assert.match(summary.content, /compare\/robotutor\.\.\.automation\/ketcher-upstream-sync/);
	assert.deepEqual(
		events.slice(-2).map((event) => event.kind),
		["summary", "log"],
	);
});

for (const failPath of [pullsPath, dispatchPath])
	test(`failure at ${failPath} stops without a misleading build report`, (t) => {
		const events = fixture(t, { failPath });
		assert.throws(main, /command failed/);
		assert.equal(
			events.some((event) => event.kind === "summary"),
			false,
		);
		assert.equal(apiCalls(events).at(-1).path, failPath);
	});

test("push failure stops before proposal or build dispatch", (t) => {
	const events = fixture(t, { failGit: `push origin HEAD:refs/heads/${proposalHead}` });
	assert.throws(main, /git failed/);
	assert.equal(
		events.some((event) => event.path?.includes("/pulls") || event.path === dispatchPath),
		false,
	);
});

test("without a summary file, the successful build request is still logged", (t) => {
	const events = fixture(t, { unchanged: true, env: { GITHUB_STEP_SUMMARY: "" } });
	main();
	assert.deepEqual(
		reported(events).map((event) => event.kind),
		["log"],
	);
});
