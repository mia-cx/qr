import { describe, expect, it } from 'vitest';

import { getStudioSectionForPath, normalizeStudioRoutePath } from './studio';

describe('studio route helpers', () => {
	it('maps shortcut routes to the matching accordion section', () => {
		expect(getStudioSectionForPath('/create')).toBe('generate');
		expect(getStudioSectionForPath('/create/')).toBe('generate');
		expect(getStudioSectionForPath('/read')).toBe('read');
		expect(getStudioSectionForPath('/read/')).toBe('read');
		expect(getStudioSectionForPath('/')).toBeNull();
	});

	it('reroutes shortcut paths onto the single studio page', () => {
		expect(normalizeStudioRoutePath('/create')).toBe('/');
		expect(normalizeStudioRoutePath('/read')).toBe('/');
		expect(normalizeStudioRoutePath('/')).toBe('/');
		expect(normalizeStudioRoutePath('/something-else')).toBe('/something-else');
	});
});
