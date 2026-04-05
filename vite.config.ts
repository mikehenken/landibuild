// import { sentryVitePlugin } from '@sentry/vite-plugin';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import { parse } from 'jsonc-parser';
import type { ParseError } from 'jsonc-parser';

import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Cloudflare CI runs `vite build` without `.env.local`. Supabase in the browser needs
 * `VITE_*` strings inlined at build time. When those env vars are unset, read public
 * values from `wrangler.jsonc` (same source as Worker `SUPABASE_URL`).
 */
function readWranglerSupabaseForVite(): {
	url: string;
	anon: string;
	useAuthRaw: string;
} {
	const empty = { url: '', anon: '', useAuthRaw: '' };
	try {
		const text = readFileSync(path.resolve(__dirname, 'wrangler.jsonc'), 'utf-8');
		const errors: ParseError[] = [];
		const cfg = parse(text, errors, { allowTrailingComma: true }) as {
			vars?: Record<string, unknown>;
		} | null;
		if (!cfg?.vars) {
			return empty;
		}
		const v = cfg.vars;
		const str = (key: string): string => {
			const val = v[key];
			if (val === undefined || val === null) {
				return '';
			}
			return String(val).trim();
		};
		return {
			url: str('SUPABASE_URL'),
			anon: str('SUPABASE_ANON_KEY'),
			useAuthRaw: str('USE_SUPABASE_AUTH'),
		};
	} catch {
		return empty;
	}
}

function viteSupabaseClientDefine(): Record<string, string> {
	const w = readWranglerSupabaseForVite();
	const url = process.env.VITE_SUPABASE_URL?.trim() || w.url;
	const anon = process.env.VITE_SUPABASE_ANON_KEY?.trim() || w.anon;

	let useAuth: string;
	if (
		process.env.VITE_USE_SUPABASE_AUTH !== undefined &&
		process.env.VITE_USE_SUPABASE_AUTH !== ''
	) {
		useAuth = String(process.env.VITE_USE_SUPABASE_AUTH).trim();
	} else if (
		w.useAuthRaw.toLowerCase() === 'true' ||
		w.useAuthRaw === '1'
	) {
		useAuth = 'true';
	} else {
		useAuth = '';
	}

	if (url === '' && anon === '' && useAuth === '') {
		return {};
	}

	return {
		'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(url),
		'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(anon),
		'import.meta.env.VITE_USE_SUPABASE_AUTH': JSON.stringify(useAuth),
	};
}

// https://vite.dev/config/
export default defineConfig({
	optimizeDeps: {
		exclude: ['format', 'editor.all'],
		include: ['monaco-editor/esm/vs/editor/editor.api'],
		force: true,
	},

	// build: {
	//     rollupOptions: {
	//       output: {
	//             advancedChunks: {
	//                 groups: [{name: 'vendor', test: /node_modules/}]
	//             }
	//         }
	//     }
	// },
	plugins: [
		react(),
		svgr(),
		cloudflare({
			configPath: 'wrangler.jsonc',
			// @cloudflare/vite-plugin cannot build/pull sandbox images on native Windows (use WSL for full container dev).
			...(process.platform === 'win32'
				? {
						config: (wranglerConfig) => ({
							dev: {
								...wranglerConfig.dev,
								enable_containers: false,
							},
						}),
					}
				: {}),
		}),
		tailwindcss(),
		// sentryVitePlugin({
		// 	org: 'cloudflare-0u',
		// 	project: 'javascript-react',
		// }),
	],

	resolve: {
		alias: {
			debug: 'debug/src/browser',
			'@': path.resolve(__dirname, './src'),
			'shared': path.resolve(__dirname, './shared'),
			'worker': path.resolve(__dirname, './worker'),
		},
	},

	// @cloudflare/vite-plugin uses a dedicated Worker environment (name = wrangler top-level name with `-` → `_`).
	// Root `resolve.alias` applies to `client`; without this, Miniflare gets an unresolvable Worker bundle → Vite "fetch failed".
	environments: {
		landibuild: {
			resolve: {
				alias: {
					debug: 'debug/src/browser',
					'@': path.resolve(__dirname, './src'),
					shared: path.resolve(__dirname, './shared'),
					worker: path.resolve(__dirname, './worker'),
				},
			} as import('vite').ResolveOptions,
		},
	},

	// Configure for Prisma + Cloudflare Workers compatibility
	define: {
		// Ensure proper module definitions for Cloudflare Workers context
		'process.env.NODE_ENV': JSON.stringify(
			process.env.NODE_ENV || 'development',
		),
		global: 'globalThis',
		// '__filename': '""',
		// '__dirname': '""',
		...viteSupabaseClientDefine(),
	},

	worker: {
		// Handle Prisma in worker context for development
		format: 'es',
	},

	server: {
		allowedHosts: true,
	},

	// Clear cache more aggressively
	cacheDir: 'node_modules/.vite',
});
