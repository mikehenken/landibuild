import { createHash, createSign, createVerify, type KeyObject } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { canonicalizeJson } from './canonical.js';
import type { HandoffCore } from './schema.js';

export const GENESIS_CHAIN_HASH =
	'0000000000000000000000000000000000000000000000000000000000000000';

export type StoredRecord = {
	sequence: number;
	prev_chain_hash: string;
	chain_hash: string;
	fingerprint: string;
	canonical: string;
	signature_ed25519_base64?: string;
};

export function sha256Hex(data: string): string {
	return createHash('sha256').update(data, 'utf8').digest('hex');
}

export function computeFingerprint(canonical: string): string {
	return sha256Hex(canonical);
}

export function computeChainHash(prevChainHash: string, fingerprint: string): string {
	return sha256Hex(`${prevChainHash}\n${fingerprint}`);
}

export function buildCanonicalRecord(core: HandoffCore): string {
	return canonicalizeJson(core);
}

export function signCanonical(
	canonical: string,
	privateKey: KeyObject,
): string {
	const sign = createSign('Ed25519');
	sign.update(canonical, 'utf8');
	sign.end();
	return sign.sign(privateKey).toString('base64');
}

export function verifySignature(
	canonical: string,
	signatureBase64: string,
	publicKey: KeyObject,
): boolean {
	const verify = createVerify('Ed25519');
	verify.update(canonical, 'utf8');
	verify.end();
	return verify.verify(publicKey, Buffer.from(signatureBase64, 'base64'));
}

export async function readLogLines(logPath: string): Promise<StoredRecord[]> {
	let raw: string;
	try {
		raw = await readFile(logPath, 'utf8');
	} catch (e: unknown) {
		const err = e as { code?: string };
		if (err.code === 'ENOENT') {
			return [];
		}
		throw e;
	}
	const lines = raw.split('\n').filter((l) => l.trim().length > 0);
	return lines.map((line) => JSON.parse(line) as StoredRecord);
}

export async function appendRecord(logPath: string, record: StoredRecord): Promise<void> {
	await mkdir(dirname(logPath), { recursive: true });
	const line = `${JSON.stringify(record)}\n`;
	await writeFile(logPath, line, { flag: 'a' });
}

export type VerifyChainOptions = {
	requireEverySignature?: boolean;
};

export function verifyChain(
	records: StoredRecord[],
	verifyKey?: KeyObject,
	options?: VerifyChainOptions,
): { ok: true } | { ok: false; error: string; atSequence?: number } {
	const requireSig = Boolean(options?.requireEverySignature);
	const fingerprints = new Set<string>();
	let prev = GENESIS_CHAIN_HASH;
	for (let i = 0; i < records.length; i++) {
		const r = records[i];
		if (r.sequence !== i) {
			return { ok: false, error: `sequence mismatch at index ${i}`, atSequence: r.sequence };
		}
		if (r.prev_chain_hash !== prev) {
			return {
				ok: false,
				error: `prev_chain_hash broken at sequence ${r.sequence}`,
				atSequence: r.sequence,
			};
		}
		const fp = computeFingerprint(r.canonical);
		if (fp !== r.fingerprint) {
			return {
				ok: false,
				error: `fingerprint mismatch at sequence ${r.sequence}`,
				atSequence: r.sequence,
			};
		}
		const expectedChain = computeChainHash(prev, r.fingerprint);
		if (expectedChain !== r.chain_hash) {
			return {
				ok: false,
				error: `chain_hash mismatch at sequence ${r.sequence}`,
				atSequence: r.sequence,
			};
		}
		if (fingerprints.has(r.fingerprint)) {
			return {
				ok: false,
				error: `duplicate fingerprint ${r.fingerprint}`,
				atSequence: r.sequence,
			};
		}
		fingerprints.add(r.fingerprint);
		if (requireSig) {
			if (!verifyKey) {
				return {
					ok: false,
					error: 'requireEverySignature set but no verify key available',
					atSequence: r.sequence,
				};
			}
			if (!r.signature_ed25519_base64) {
				return {
					ok: false,
					error: `missing signature at sequence ${r.sequence} (strict)`,
					atSequence: r.sequence,
				};
			}
		}
		if (verifyKey && r.signature_ed25519_base64) {
			const sigOk = verifySignature(r.canonical, r.signature_ed25519_base64, verifyKey);
			if (!sigOk) {
				return {
					ok: false,
					error: `Ed25519 verify failed at sequence ${r.sequence}`,
					atSequence: r.sequence,
				};
			}
		}
		prev = r.chain_hash;
	}
	return { ok: true };
}
