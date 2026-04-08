import { persistentAtom } from '@nanostores/persistent';

export interface ThemeMeta {
	id: string;
	name: string;
	accent: string;
	bg: string;
	fg: string;
}

export const themes: ThemeMeta[] = [
	{ id: 'mono-light', name: 'Light', accent: '#000000', bg: '#ffffff', fg: '#000000' },
	{ id: 'mono-dark', name: 'Dark', accent: '#ffffff', bg: '#000000', fg: '#ffffff' },
	{ id: 'catppuccin-latte', name: 'Catppuccin Latte', accent: '#8839ef', bg: '#eff1f5', fg: '#4c4f69' },
	{ id: 'catppuccin-mocha', name: 'Catppuccin Mocha', accent: '#cba6f7', bg: '#1e1e2e', fg: '#cdd6f4' },
	{ id: 'solarized-light', name: 'Solarized Light', accent: '#268bd2', bg: '#fdf6e3', fg: '#657b83' },
	{ id: 'solarized-dark', name: 'Solarized Dark', accent: '#268bd2', bg: '#002b36', fg: '#839496' },
	{ id: 'nord', name: 'Nord', accent: '#88c0d0', bg: '#2e3440', fg: '#eceff4' },
	{ id: 'rose-pine', name: 'Rose Pine', accent: '#c4a7e7', bg: '#191724', fg: '#e0def4' },
	{ id: 'gruvbox-dark', name: 'Gruvbox Dark', accent: '#fe8019', bg: '#282828', fg: '#ebdbb2' },
	{ id: 'phosphor', name: 'Phosphor', accent: '#33ff33', bg: '#0a0a0a', fg: '#33ff33' },
	{ id: 'tokyo-night', name: 'Tokyo Night', accent: '#7aa2f7', bg: '#1a1b26', fg: '#c0caf5' },
	{ id: 'paper', name: 'Paper', accent: '#c25b3f', bg: '#f5f0eb', fg: '#2c2c2c' }
];

export const DEFAULT_THEME = 'catppuccin-mocha';

export const themeStore = persistentAtom<string>('theme', DEFAULT_THEME);

export function getTheme(id: string): ThemeMeta {
	return themes.find((t) => t.id === id) ?? themes[0];
}

export function setTheme(id: string): void {
	themeStore.set(id);
	document.documentElement.setAttribute('data-theme', id);
}

export function getQrColors(): { fg: string; bg: string } {
	const style = getComputedStyle(document.documentElement);
	return {
		fg: style.getPropertyValue('--c-qr-fg').trim(),
		bg: style.getPropertyValue('--c-qr-bg').trim()
	};
}
