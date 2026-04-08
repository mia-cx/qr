import { beforeEach, describe, expect, it } from 'vitest';
import { setPersistentEngine } from '@nanostores/persistent';

import { DEFAULT_THEME, applyDocumentTheme, setTheme, themeStore } from './index';

describe('theme helpers', () => {
	const storage: Record<string, string> = {};
	const metaThemeColor = {
		content: '#1e1e2e',
		setAttribute: (_name: string, value: string) => (metaThemeColor.content = value)
	};
	const documentElement = {
		dataset: {} as Record<string, string>,
		style: { background: '' },
		setAttribute: (name: string, value: string) => {
			if (name === 'data-theme') {
				documentElement.dataset.theme = value;
			}
		}
	};
	const bodyStyle = {
		background: '',
		setProperty: (name: string, value: string) => {
			if (name === 'background') {
				bodyStyle.background = value;
			}
		}
	};

	beforeEach(() => {
		for (const key of Object.keys(storage)) {
			delete storage[key];
		}

		setPersistentEngine(storage, {
			addEventListener() {},
			removeEventListener() {}
		});

		metaThemeColor.content = '#1e1e2e';
		documentElement.dataset = { theme: DEFAULT_THEME };
		documentElement.style.background = '';
		bodyStyle.background = '';
		Object.defineProperty(globalThis, 'document', {
			configurable: true,
			value: {
				documentElement,
				body: { style: bodyStyle },
				querySelector: (selector: string) =>
					selector === 'meta[name="theme-color"]' ? metaThemeColor : null
			}
		});
		themeStore.set(DEFAULT_THEME);
		delete storage.theme;
	});

	it('persists the selected theme and applies it to the document', () => {
		setTheme('paper');

		expect(themeStore.get()).toBe('paper');
		expect(storage.theme).toBe('paper');
		expect(documentElement.dataset.theme).toBe('paper');
		expect(metaThemeColor.content).toBe('#f5f0eb');
	});

	it('normalizes unknown theme ids to the default theme', () => {
		setTheme('not-a-real-theme');

		expect(themeStore.get()).toBe(DEFAULT_THEME);
		expect(storage.theme).toBe(DEFAULT_THEME);
		expect(documentElement.dataset.theme).toBe(DEFAULT_THEME);
	});

	it('updates document chrome without writing to storage directly', () => {
		applyDocumentTheme('mono-dark');

		expect(storage.theme).toBeUndefined();
		expect(documentElement.dataset.theme).toBe('mono-dark');
		expect(metaThemeColor.content).toBe('#000000');
	});
});
