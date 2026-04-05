#!/usr/bin/env node
import {
	createPrivateKey,
	createPublicKey,
	type KeyObject,
} from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { ArtifactDigest } from './artifacts.js';
import { digestArtifactsFromWorkspace } from './artifacts.js';
import {
	appendRecord,
	buildCanonicalRecord,
	computeChainHash,
	computeFingerprint,
	GENESIS_CHAIN_HASH,
	readLogLines,
	signCanonical,
	verifyChain,
} from './log.js';
import { parseCoreFromCanonical } from './parse-core.js';
import {
	appendInputSchema,
	commitHandoffInputSchema,
	handoffCoreSchema,
	verifyGateInputSchema,
} from './schema.js';
import {
	isStrictMode,
	requireChainTip,
	workspaceRootFromEnv,
} from './strict.js';

function loadOptionalSigningKey(): KeyObject | undefined {
	const pem = process.env.COORDINATOR_HANDOFF_SIGNING_KEY_PEM?.trim();
	if (!pem) {
		return undefined;
	}
	return createPrivateKey({ key: pem, format: 'pem' });
}

function loadOptionalVerifyKey(): KeyObject | undefined {
	const pem = process.env.COORDINATOR_HANDOFF_VERIFY_KEY_PEM?.trim();
	if (!pem) {
		return undefined;
	}
	return createPublicKey({ key: pem, format: 'pem' });
}

function logPathFromEnv(): string {
	const raw = process.env.COORDINATOR_HANDOFF_LOG_PATH?.trim();
	if (raw) {
		return raw;
	}
	throw new Error(
		'COORDINATOR_HANDOFF_LOG_PATH is required (absolute or cwd-relative JSONL path)',
	);
}

function jsonResult(payload: unknown) {
	return { content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }] };
}

function stripClientArtifacts(body: Record<string, unknown>): Record<string, unknown> {
	const { artifacts: _drop, ...rest } = body;
	return rest;
}

function digestsEqual(a: ArtifactDigest[], b: ArtifactDigest[]): boolean {
	if (a.length !== b.length) {
		return false;
	}
	for (let i = 0; i < a.length; i++) {
		if (a[i].path !== b[i].path || a[i].content_sha256 !== b[i].content_sha256) {
			return false;
		}
	}
	return true;
}

function readArtifactsFromLoggedBody(body: Record<string, unknown>): ArtifactDigest[] | null {
	const raw = body.artifacts;
	if (!Array.isArray(raw)) {
		return null;
	}
	const out: ArtifactDigest[] = [];
	for (const item of raw) {
		if (!item || typeof item !== 'object') {
			return null;
		}
		const o = item as Record<string, unknown>;
		if (typeof o.path !== 'string' || typeof o.content_sha256 !== 'string') {
			return null;
		}
		if (!/^[a-f0-9]{64}$/.test(o.content_sha256)) {
			return null;
		}
		out.push({ path: o.path, content_sha256: o.content_sha256 });
	}
	out.sort((x, y) => x.path.localeCompare(y.path));
	return out;
}

type AppendParams = {
	study_id: string;
	phase_id: string;
	actor_type: 'coordinator' | 'subagent' | 'system' | 'reviewer';
	task_id?: string;
	timestamp?: string;
	prev_chain_tip?: string;
	artifact_paths?: string[];
	body: Record<string, unknown>;
};

async function performAppend(
	logPath: string,
	signKey: KeyObject | undefined,
	verifyKey: KeyObject | undefined,
	params: AppendParams,
	options: { requireSigning: boolean; enforceChainTip: boolean },
): Promise<Record<string, unknown>> {
	if (options.requireSigning && !signKey) {
		return { ok: false, error: 'signing required but COORDINATOR_HANDOFF_SIGNING_KEY_PEM not set' };
	}

	const workspaceRoot = workspaceRootFromEnv();
	const paths = params.artifact_paths;
	if (paths && paths.length > 0) {
		if (!workspaceRoot) {
			return {
				ok: false,
				error:
					'artifact_paths require COORDINATOR_HANDOFF_WORKSPACE_ROOT (absolute path to repo/study root)',
			};
		}
	}

	const existing = await readLogLines(logPath);
	const actualPrevTip =
		existing.length > 0 ? existing[existing.length - 1].chain_hash : GENESIS_CHAIN_HASH;

	if (options.enforceChainTip) {
		if (!params.prev_chain_tip) {
			return {
				ok: false,
				error: 'prev_chain_tip required (strict or COORDINATOR_HANDOFF_REQUIRE_CHAIN_TIP); call get_chain_tip first',
				actual_prev_tip: actualPrevTip,
			};
		}
		if (params.prev_chain_tip !== actualPrevTip) {
			return {
				ok: false,
				error: 'prev_chain_tip mismatch (stale tip or forked client)',
				expected: actualPrevTip,
				got: params.prev_chain_tip,
			};
		}
	}

	const chainVerify = verifyChain(existing, verifyKey, {
		requireEverySignature: isStrictMode(),
	});
	if (!chainVerify.ok) {
		return { ok: false, error: 'log_corrupt_before_append', detail: chainVerify };
	}

	let artifacts: ArtifactDigest[] | undefined;
	if (paths && paths.length > 0 && workspaceRoot) {
		try {
			artifacts = await digestArtifactsFromWorkspace(workspaceRoot, paths);
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			return { ok: false, error: 'artifact_digest_failed', detail: msg };
		}
	}

	const cleanedBody = stripClientArtifacts(params.body);
	const body =
		artifacts !== undefined ? { ...cleanedBody, artifacts } : cleanedBody;

	const ts = params.timestamp ?? new Date().toISOString();
	const coreRaw = {
		schema_version: 1 as const,
		study_id: params.study_id,
		phase_id: params.phase_id,
		actor_type: params.actor_type,
		timestamp: ts,
		...(params.task_id !== undefined ? { task_id: params.task_id } : {}),
		body,
	};
	const core = handoffCoreSchema.parse(coreRaw);
	const canonical = buildCanonicalRecord(core);
	const fingerprint = computeFingerprint(canonical);

	for (const r of existing) {
		if (r.fingerprint === fingerprint) {
			return {
				ok: false,
				error: 'duplicate_fingerprint',
				fingerprint,
				message: 'Same canonical payload already committed.',
			};
		}
	}

	const chain_hash = computeChainHash(actualPrevTip, fingerprint);
	const sequence = existing.length;
	const record = {
		sequence,
		prev_chain_hash: actualPrevTip,
		chain_hash,
		fingerprint,
		canonical,
		...(signKey ? { signature_ed25519_base64: signCanonical(canonical, signKey) } : {}),
	};
	await appendRecord(logPath, record);
	return {
		ok: true,
		sequence,
		fingerprint,
		prev_chain_hash: actualPrevTip,
		chain_hash,
		signed: Boolean(signKey),
	};
}

async function main(): Promise<void> {
	const logPath = logPathFromEnv();
	const signKey = loadOptionalSigningKey();
	let verifyKey = loadOptionalVerifyKey();
	if (!verifyKey && signKey) {
		verifyKey = createPublicKey(signKey);
	}

	if (isStrictMode()) {
		if (!signKey) {
			throw new Error(
				'COORDINATOR_HANDOFF_STRICT requires COORDINATOR_HANDOFF_SIGNING_KEY_PEM',
			);
		}
		if (!verifyKey) {
			throw new Error(
				'COORDINATOR_HANDOFF_STRICT requires a verify key (set COORDINATOR_HANDOFF_VERIFY_KEY_PEM or valid signing key)',
			);
		}
	}

	const requireSigning = isStrictMode();
	const chainTipRequired = requireChainTip();

	const sharedProps = {
		study_id: { type: 'string' },
		phase_id: { type: 'string' },
		actor_type: {
			type: 'string',
			enum: ['coordinator', 'subagent', 'system', 'reviewer'],
		},
		task_id: { type: 'string' },
		timestamp: { type: 'string' },
		prev_chain_tip: {
			type: 'string',
			description: '64 hex; current tip from get_chain_tip (required in strict mode)',
		},
		artifact_paths: {
			type: 'array',
			items: { type: 'string' },
			description: 'Paths relative to COORDINATOR_HANDOFF_WORKSPACE_ROOT',
		},
		body: { type: 'object' },
	};

	const server = new Server(
		{ name: 'coordinator-handoff-mcp', version: '0.2.1' },
		{ capabilities: { tools: {} } },
	);

	server.setRequestHandler(ListToolsRequestSchema, async () => ({
		tools: [
			{
				name: 'get_chain_tip',
				description:
					'Return the current chain tip hash (64 hex). Call before append_handoff/commit_handoff when chain tip is required.',
				inputSchema: { type: 'object', properties: {} },
			},
			{
				name: 'append_handoff',
				description:
					'Append handoff record with optional server-side artifact binding. In STRICT mode signing and prev_chain_tip are mandatory; every record must verify.',
				inputSchema: {
					type: 'object',
					properties: sharedProps,
					required: ['study_id', 'phase_id', 'actor_type'],
				},
			},
			{
				name: 'commit_handoff',
				description:
					'Atomic phase commit: requires prev_chain_tip + artifact_paths. Prefer this for gated phase completion (single read/hash of files before append).',
				inputSchema: {
					type: 'object',
					properties: sharedProps,
					required: ['study_id', 'phase_id', 'actor_type', 'prev_chain_tip', 'artifact_paths'],
				},
			},
			{
				name: 'verify_phase_gate',
				description:
					'Verify full chain, locate latest record for study_id+phase_id, re-hash artifact_paths on disk and require match to logged body.artifacts. Use before accepting human checkpoint;',
				inputSchema: {
					type: 'object',
					properties: {
						study_id: { type: 'string' },
						phase_id: { type: 'string' },
						artifact_paths: { type: 'array', items: { type: 'string' } },
						expected_fingerprint: {
							type: 'string',
							description: 'Optional 64 hex fingerprint pin',
						},
						actor_type: {
							type: 'string',
							enum: ['coordinator', 'subagent', 'system', 'reviewer'],
						},
					},
					required: ['study_id', 'phase_id', 'artifact_paths'],
				},
			},
			{
				name: 'verify_log',
				description: 'Verify append-only chain; in STRICT every record must be signed.',
				inputSchema: { type: 'object', properties: {} },
			},
			{
				name: 'get_entry_by_fingerprint',
				description: 'Return one log entry by fingerprint hex.',
				inputSchema: {
					type: 'object',
					properties: { fingerprint: { type: 'string', minLength: 64, maxLength: 64 } },
					required: ['fingerprint'],
				},
			},
		],
	}));

	server.setRequestHandler(CallToolRequestSchema, async (request) => {
		const { name, arguments: args } = request.params;

		if (name === 'get_chain_tip') {
			const records = await readLogLines(logPath);
			const tip =
				records.length > 0 ? records[records.length - 1].chain_hash : GENESIS_CHAIN_HASH;
			return jsonResult({
				ok: true,
				prev_chain_tip: tip,
				record_count: records.length,
			});
		}

		if (name === 'append_handoff') {
			const parsed = appendInputSchema.safeParse(args ?? {});
			if (!parsed.success) {
				return jsonResult({ ok: false, error: parsed.error.flatten() });
			}
			const d = parsed.data;
			return jsonResult(
				await performAppend(
					logPath,
					signKey,
					verifyKey,
					{
						study_id: d.study_id,
						phase_id: d.phase_id,
						actor_type: d.actor_type,
						task_id: d.task_id,
						timestamp: d.timestamp,
						prev_chain_tip: d.prev_chain_tip,
						artifact_paths: d.artifact_paths,
						body: d.body,
					},
					{ requireSigning, enforceChainTip: chainTipRequired },
				),
			);
		}

		if (name === 'commit_handoff') {
			const parsed = commitHandoffInputSchema.safeParse(args ?? {});
			if (!parsed.success) {
				return jsonResult({ ok: false, error: parsed.error.flatten() });
			}
			const d = parsed.data;
			return jsonResult(
				await performAppend(
					logPath,
					signKey,
					verifyKey,
					{
						study_id: d.study_id,
						phase_id: d.phase_id,
						actor_type: d.actor_type,
						task_id: d.task_id,
						timestamp: d.timestamp,
						prev_chain_tip: d.prev_chain_tip,
						artifact_paths: d.artifact_paths,
						body: d.body,
					},
					{ requireSigning, enforceChainTip: true },
				),
			);
		}

		if (name === 'verify_phase_gate') {
			const parsed = verifyGateInputSchema.safeParse(args ?? {});
			if (!parsed.success) {
				return jsonResult({ ok: false, error: parsed.error.flatten() });
			}
			const v = parsed.data;
			const workspaceRoot = workspaceRootFromEnv();
			if (!workspaceRoot) {
				return jsonResult({
					ok: false,
					error: 'COORDINATOR_HANDOFF_WORKSPACE_ROOT required for verify_phase_gate',
				});
			}

			let freshDigests: ArtifactDigest[];
			try {
				freshDigests = await digestArtifactsFromWorkspace(workspaceRoot, v.artifact_paths);
			} catch (e: unknown) {
				const msg = e instanceof Error ? e.message : String(e);
				return jsonResult({ ok: false, error: 'artifact_digest_failed', detail: msg });
			}

			const records = await readLogLines(logPath);
			const chainV = verifyChain(records, verifyKey, {
				requireEverySignature: isStrictMode(),
			});
			if (!chainV.ok) {
				return jsonResult({ ok: false, error: 'chain_invalid', detail: chainV });
			}

			let latestForPhase: (typeof records)[0] | undefined;
			for (let i = records.length - 1; i >= 0; i--) {
				const r = records[i];
				let core: ReturnType<typeof parseCoreFromCanonical>;
				try {
					core = parseCoreFromCanonical(r.canonical);
				} catch {
					continue;
				}
				if (core.study_id !== v.study_id || core.phase_id !== v.phase_id) {
					continue;
				}
				if (v.actor_type !== undefined && core.actor_type !== v.actor_type) {
					continue;
				}
				latestForPhase = r;
				break;
			}

			if (!latestForPhase) {
				return jsonResult({
					ok: false,
					error: 'no_record_for_study_phase',
					hint: 'Run commit_handoff for this study_id and phase_id first.',
				});
			}

			const coreLatest = parseCoreFromCanonical(latestForPhase.canonical);
			const body = coreLatest.body as Record<string, unknown>;
			const logged = readArtifactsFromLoggedBody(body);
			if (!logged) {
				return jsonResult({
					ok: false,
					error: 'committed_record_has_no_artifacts',
					sequence: latestForPhase.sequence,
				});
			}
			if (!digestsEqual(logged, freshDigests)) {
				return jsonResult({
					ok: false,
					error: 'artifact_mismatch_disk_vs_log',
					sequence: latestForPhase.sequence,
					on_disk: freshDigests,
					in_log: logged,
				});
			}

			const matched = latestForPhase;

			if (v.expected_fingerprint !== undefined && matched.fingerprint !== v.expected_fingerprint) {
				return jsonResult({
					ok: false,
					error: 'fingerprint_pin_mismatch',
					expected: v.expected_fingerprint,
					got: matched.fingerprint,
				});
			}

			return jsonResult({
				ok: true,
				accepted: true,
				fingerprint: matched.fingerprint,
				sequence: matched.sequence,
				chain_hash: matched.chain_hash,
				artifacts_match_disk: true,
			});
		}

		if (name === 'verify_log') {
			const records = await readLogLines(logPath);
			const result = verifyChain(records, verifyKey, {
				requireEverySignature: isStrictMode(),
			});
			return jsonResult({
				ok: result.ok,
				record_count: records.length,
				tip_chain_hash:
					records.length > 0 ? records[records.length - 1].chain_hash : GENESIS_CHAIN_HASH,
				strict: isStrictMode(),
				...(result.ok ? {} : { error: result.error, atSequence: result.atSequence }),
			});
		}

		if (name === 'get_entry_by_fingerprint') {
			const fp = (args as { fingerprint?: string } | undefined)?.fingerprint;
			if (!fp || !/^[a-f0-9]{64}$/.test(fp)) {
				return jsonResult({ ok: false, error: 'fingerprint must be 64 hex chars' });
			}
			const records = await readLogLines(logPath);
			const idx = records.findIndex((r) => r.fingerprint === fp);
			if (idx === -1) {
				return jsonResult({ ok: false, error: 'not_found', fingerprint: fp });
			}
			const r = records[idx];
			return jsonResult({
				ok: true,
				index: idx,
				record: r,
				prev: idx > 0 ? records[idx - 1].chain_hash : GENESIS_CHAIN_HASH,
			});
		}

		return jsonResult({ ok: false, error: `unknown_tool:${name}` });
	});

	const transport = new StdioServerTransport();
	await server.connect(transport);
}

main().catch((err: unknown) => {
	console.error(err);
	process.exit(1);
});
