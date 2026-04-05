import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { normalize, relative, resolve } from 'node:path';

export type ArtifactDigest = { path: string; content_sha256: string };

function sha256FileHex(buf: Buffer): string {
	return createHash('sha256').update(buf).digest('hex');
}

/**
 * Resolve paths under workspace root; reject escapes, non-files, symlinks.
 * `relativePath` uses forward slashes or OS separators relative to workspace root.
 */
export async function digestArtifactsFromWorkspace(
	workspaceRoot: string,
	relativePaths: string[],
): Promise<ArtifactDigest[]> {
	const root = resolve(workspaceRoot);
	const unique = [...new Set(relativePaths)];
	const out: ArtifactDigest[] = [];

	for (const relRaw of unique) {
		if (!relRaw || relRaw.trim() === '') {
			throw new Error('empty artifact path');
		}
		const normalizedRel = normalize(relRaw);
		if (normalizedRel.startsWith('..')) {
			throw new Error(`artifact path must not start with ..: ${relRaw}`);
		}
		const abs = resolve(root, normalizedRel);
		const relCheck = relative(root, abs);
		if (relCheck.startsWith('..') || relCheck === '..') {
			throw new Error(`artifact path escapes workspace: ${relRaw}`);
		}

		const st = await lstat(abs);
		if (st.isSymbolicLink()) {
			throw new Error(`symlink not allowed for artifacts: ${relRaw}`);
		}
		if (!st.isFile()) {
			throw new Error(`artifact not a regular file: ${relRaw}`);
		}

		const buf = await readFile(abs);
		out.push({
			path: relCheck.split('\\').join('/'),
			content_sha256: sha256FileHex(buf),
		});
	}

	out.sort((a, b) => a.path.localeCompare(b.path));
	return out;
}
