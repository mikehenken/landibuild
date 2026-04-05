import { describe, expect, it } from 'vitest';
import { isStageProgressMarkdown } from './thinking-stage-cards';

describe('isStageProgressMarkdown', () => {
	it('returns true for typical legacy bootstrap / blueprint / code list', () => {
		const body = `Thinking…

* Bootstrapping project
* Generating Blueprint
* Generating code`;
		expect(isStageProgressMarkdown(body)).toBe(true);
	});

	it('returns false for prose with one bullet', () => {
		expect(
			isStageProgressMarkdown(`Here is a note:

- We should tweak the blueprint copy`),
		).toBe(false);
	});

	it('returns false without list markers', () => {
		expect(isStageProgressMarkdown('Bootstrapping project and blueprint follow.')).toBe(false);
	});

	it('returns false for empty content', () => {
		expect(isStageProgressMarkdown('')).toBe(false);
	});
});
