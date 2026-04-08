import { describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';

import Harness from './DateRangePicker.harness.svelte';

describe('DateRangePicker', () => {
	it('updates the displayed range when parent props change after mount', () => {
		const target = document.createElement('div');
		document.body.appendChild(target);

		const app = mount(Harness, { target });
		flushSync();

		const display = target.querySelector('.date-trigger-text');
		expect(display?.textContent).toContain('1/4/2026 09:00 - 2/4/2026 10:00');

		const button = target.querySelector('[data-testid="update-props"]');
		if (!(button instanceof HTMLButtonElement)) {
			throw new Error('Expected update button to be rendered');
		}

		button.click();
		flushSync();

		expect(display?.textContent).toContain('3/4/2026 12:30 - 4/4/2026 14:45');

		unmount(app);
		target.remove();
	});
});
