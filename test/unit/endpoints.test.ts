import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { ModelRoutingController } from '../../worker/api/controllers/modelRouting/controller';

describe('ModelRoutingController Integration Tests', () => {
    beforeAll(async () => {
        const db = env.DB;
        
        await db.exec(`
            CREATE TABLE IF NOT EXISTS custom_endpoints (id text PRIMARY KEY, scope_kind text, scope_id text, name text, provider_kind text, base_url text, headers text, auth_ref text, created_at integer);
            CREATE TABLE IF NOT EXISTS demand_transformers (id text PRIMARY KEY, scope_kind text, scope_id text, priority integer, locked integer, transformers text, applies_when text, ttl_expires_at integer, status text, created_at integer);
            CREATE TABLE IF NOT EXISTS model_config_global_revision (id text PRIMARY KEY, revision integer, updated_at integer);
            CREATE TABLE IF NOT EXISTS models (id text PRIMARY KEY, display_name text, provider text, invocation_kind text, endpoint_id text, supports_tools integer, supports_streaming integer, supports_vision integer, supports_audio_input integer, supports_json_mode integer, supports_system_prompt integer, supports_thinking integer, max_input_tokens integer, max_output_tokens integer, max_image_count integer, max_audio_seconds integer, input_cost_per_mtok real, output_cost_per_mtok real, per_request_cost real, cost_tier text, latency_class text, quality_tier text, default_temperature real, default_reasoning text, default_max_output integer, native_hints text, tags text, use_cases text, verification text, status text, scope_kind text, scope_id text, fallback_model_id text, replaces_model_id text, created_at integer, updated_at integer, deprecated_at integer);
        `);

        // Seed D1
        await db.prepare(`
            INSERT INTO model_config_global_revision (id, revision) VALUES ('global', 1) 
            ON CONFLICT(id) DO UPDATE SET revision = 1
        `).run();

        const models = [
            { id: 'landi-2.5-pro', display_name: 'Landi 2.5 Pro', provider: 'unknown', invocation_kind: 'text', verification: 'self-declared' },
            { id: 'gemini-3.1-pro-flash-image-preview', display_name: 'Gemini 3.1 Pro', provider: 'gemini', invocation_kind: 'image', verification: 'self-declared' },
            { id: 'openai-tts-1', display_name: 'OpenAI TTS', provider: 'openai-compat', invocation_kind: 'audio', verification: 'self-declared' }
        ];

        for (const m of models) {
            await db.prepare(`
                INSERT INTO models (id, display_name, provider, invocation_kind, verification)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(id) DO NOTHING
            `).bind(m.id, m.display_name, m.provider, m.invocation_kind, m.verification).run();
        }
    });

    it('compile-bundle endpoint returns <= 256 KB gzipped', async () => {
        const request = new Request('http://localhost/api/model-routing/compile-bundle?revision=1', { method: 'POST' });
        const response = await ModelRoutingController.compileBundle(request, env as any, {} as any, {} as any);
        
        expect(response.status).toBe(200);
        
        const data = await response.json();
        const jsonStr = JSON.stringify(data);
        
        // Gzip the response body
        const encoder = new TextEncoder();
        const uint8Array = encoder.encode(jsonStr);
        const stream = new CompressionStream('gzip');
        const writer = stream.writable.getWriter();
        await writer.write(uint8Array);
        await writer.close();
        const reader = stream.readable.getReader();
        const chunks: Uint8Array[] = [];
        let result = await reader.read();
        while (!result.done) {
            chunks.push(result.value);
            result = await reader.read();
        }
        const totalSize = chunks.reduce((acc, chunk) => acc + chunk.length, 0);

        expect(totalSize).toBeLessThanOrEqual(262144);
    });

    it('should compile hotPaths properly from seeded D1', async () => {
        const request = new Request('http://localhost/api/model-routing/compile-bundle', { method: 'POST' });
        const response = await ModelRoutingController.compileBundle(request, env as any, {} as any, {} as any);
        const data = await response.json() as any;
        const keys = Object.keys(data?.data?.hotPaths || {});
        const nasEditKey = keys.find(k => k.startsWith('nasEdit|'));
        expect(nasEditKey).toBeDefined();
        expect(data?.data?.hotPaths[nasEditKey!].modelId).toBe('landi-2.5-pro');
        expect(data?.data?.fallbacks?.text).toBe('landi-2.5-pro');
        expect(data?.data?.fallbacks?.image).toBe('gemini-3.1-pro-flash-image-preview');
    });
});
