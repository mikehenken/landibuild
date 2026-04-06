#!/usr/bin/env npx tsx
/**
 * Keeps local D1 aligned with `migrations/` for @cloudflare/vite-plugin (same store as
 * `wrangler d1 migrations apply --local`: `<project>/.wrangler/state/v3/d1`).
 *
 * Fast path: if migration SQL checksum unchanged and local D1 dir exists, skip (~7s saved).
 * Set FORCE_D1_MIGRATE=1 to always run wrangler. After `rm -rf .wrangler`, the next run applies.
 */

import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const MIGRATIONS_DIR = join(PROJECT_ROOT, 'migrations');
const D1_STORE_DIR = join(PROJECT_ROOT, '.wrangler', 'state', 'v3', 'd1');
const STAMP_PATH = join(PROJECT_ROOT, '.wrangler', 'state', 'landibuild-d1-migrations.stamp');
const WRANGLER_CONFIG = join(PROJECT_ROOT, 'wrangler.jsonc');

function fingerprintMigrations(): string {
	const files = readdirSync(MIGRATIONS_DIR)
		.filter((f) => f.endsWith('.sql'))
		.sort();
	if (files.length === 0) {
		throw new Error(`No .sql files in ${MIGRATIONS_DIR}`);
	}
	const hash = createHash('sha256');
	for (const name of files) {
		hash.update(name);
		hash.update('\0');
		hash.update(readFileSync(join(MIGRATIONS_DIR, name)));
	}
	return hash.digest('hex');
}

function localD1StorePresent(): boolean {
	try {
		return existsSync(D1_STORE_DIR) && readdirSync(D1_STORE_DIR).length > 0;
	} catch {
		return false;
	}
}

function readStamp(): string {
	try {
		return readFileSync(STAMP_PATH, 'utf-8').trim();
	} catch {
		return '';
	}
}

function writeStamp(fp: string): void {
	mkdirSync(dirname(STAMP_PATH), { recursive: true });
	writeFileSync(STAMP_PATH, `${fp}\n`, 'utf-8');
}

function runApply(): void {
	execSync(
		'npx wrangler d1 migrations apply landibuild --local --config wrangler.jsonc',
		{
			cwd: PROJECT_ROOT,
			stdio: 'inherit',
			env: { ...process.env, CI: 'true' },
		},
	);
}

function main(): void {
	const force = process.env.FORCE_D1_MIGRATE === '1' || process.env.FORCE_D1_MIGRATE === 'true';
	const fp = fingerprintMigrations();
	const prev = readStamp();

	if (
		!force &&
		prev === fp &&
		localD1StorePresent()
	) {
		console.log('[d1] local migrations already applied (checksum match, D1 store present).');
		return;
	}

	console.log(
		force
			? '[d1] FORCE_D1_MIGRATE set — applying local D1 migrations…'
			: '[d1] applying local D1 migrations (new/changed SQL or empty local store)…',
	);

	if (!existsSync(WRANGLER_CONFIG)) {
		throw new Error(`Missing ${WRANGLER_CONFIG}`);
	}

	runApply();
	writeStamp(fp);
	console.log('[d1] local D1 migrations OK.');
}

main();
