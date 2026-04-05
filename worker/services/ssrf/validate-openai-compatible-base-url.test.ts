import { describe, expect, it } from 'vitest';
import { validateOpenAiCompatibleBaseUrl } from './validate-openai-compatible-base-url';

describe('validateOpenAiCompatibleBaseUrl', () => {
	it('accepts public https origins', () => {
		const r = validateOpenAiCompatibleBaseUrl('https://api.openai.com/v1');
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.normalizedBaseUrl.startsWith('https://api.openai.com')).toBe(true);
	});

	it('rejects http by default', () => {
		const r = validateOpenAiCompatibleBaseUrl('http://example.com');
		expect(r.ok).toBe(false);
	});

	it('allows http when allowHttp is true', () => {
		const r = validateOpenAiCompatibleBaseUrl('http://127.0.0.1:11434', { allowHttp: true });
		expect(r.ok).toBe(false);
	});

	it('rejects localhost even with allowHttp', () => {
		const r = validateOpenAiCompatibleBaseUrl('http://localhost:8080/v1', { allowHttp: true });
		expect(r.ok).toBe(false);
	});

	it('rejects private IPv4', () => {
		expect(validateOpenAiCompatibleBaseUrl('https://10.0.0.1/v1').ok).toBe(false);
		expect(validateOpenAiCompatibleBaseUrl('https://192.168.1.1').ok).toBe(false);
		expect(validateOpenAiCompatibleBaseUrl('https://172.16.0.1').ok).toBe(false);
	});

	it('rejects metadata-style hosts', () => {
		expect(validateOpenAiCompatibleBaseUrl('https://169.254.169.254/').ok).toBe(false);
		expect(validateOpenAiCompatibleBaseUrl('https://metadata.google.internal/').ok).toBe(false);
	});

	it('rejects URLs with credentials', () => {
		expect(validateOpenAiCompatibleBaseUrl('https://user:pass@api.example.com').ok).toBe(false);
	});
});
