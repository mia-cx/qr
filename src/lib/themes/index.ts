export interface Theme {
	id: string;
	name: string;
	description: string;
	colors: {
		bg: string;
		bgSecondary: string;
		bgTertiary: string;
		fg: string;
		fgSecondary: string;
		fgMuted: string;
		accent: string;
		accentFg: string;
		border: string;
		borderFocus: string;
		qrFg: string;
		qrBg: string;
		error: string;
		success: string;
	};
}

export const themes: Theme[] = [
	{
		id: 'catppuccin-mocha',
		name: 'Catppuccin Mocha',
		description: 'Soothing pastel dark theme',
		colors: {
			bg: '#1e1e2e',
			bgSecondary: '#313244',
			bgTertiary: '#45475a',
			fg: '#cdd6f4',
			fgSecondary: '#bac2de',
			fgMuted: '#6c7086',
			accent: '#cba6f7',
			accentFg: '#1e1e2e',
			border: '#45475a',
			borderFocus: '#cba6f7',
			qrFg: '#cdd6f4',
			qrBg: '#1e1e2e',
			error: '#f38ba8',
			success: '#a6e3a1'
		}
	},
	{
		id: 'catppuccin-latte',
		name: 'Catppuccin Latte',
		description: 'Soothing pastel light theme',
		colors: {
			bg: '#eff1f5',
			bgSecondary: '#e6e9ef',
			bgTertiary: '#dce0e8',
			fg: '#4c4f69',
			fgSecondary: '#5c5f77',
			fgMuted: '#9ca0b0',
			accent: '#8839ef',
			accentFg: '#eff1f5',
			border: '#ccd0da',
			borderFocus: '#8839ef',
			qrFg: '#4c4f69',
			qrBg: '#eff1f5',
			error: '#d20f39',
			success: '#40a02b'
		}
	},
	{
		id: 'solarized-dark',
		name: 'Solarized Dark',
		description: 'Precision colors for machines and people',
		colors: {
			bg: '#002b36',
			bgSecondary: '#073642',
			bgTertiary: '#094353',
			fg: '#839496',
			fgSecondary: '#93a1a1',
			fgMuted: '#586e75',
			accent: '#268bd2',
			accentFg: '#fdf6e3',
			border: '#094353',
			borderFocus: '#268bd2',
			qrFg: '#93a1a1',
			qrBg: '#002b36',
			error: '#dc322f',
			success: '#859900'
		}
	},
	{
		id: 'solarized-light',
		name: 'Solarized Light',
		description: 'Warm precision for bright screens',
		colors: {
			bg: '#fdf6e3',
			bgSecondary: '#eee8d5',
			bgTertiary: '#ddd6c1',
			fg: '#657b83',
			fgSecondary: '#586e75',
			fgMuted: '#93a1a1',
			accent: '#268bd2',
			accentFg: '#fdf6e3',
			border: '#ddd6c1',
			borderFocus: '#268bd2',
			qrFg: '#073642',
			qrBg: '#fdf6e3',
			error: '#dc322f',
			success: '#859900'
		}
	},
	{
		id: 'nord',
		name: 'Nord',
		description: 'Arctic, north-bluish color palette',
		colors: {
			bg: '#2e3440',
			bgSecondary: '#3b4252',
			bgTertiary: '#434c5e',
			fg: '#eceff4',
			fgSecondary: '#e5e9f0',
			fgMuted: '#4c566a',
			accent: '#88c0d0',
			accentFg: '#2e3440',
			border: '#434c5e',
			borderFocus: '#88c0d0',
			qrFg: '#eceff4',
			qrBg: '#2e3440',
			error: '#bf616a',
			success: '#a3be8c'
		}
	},
	{
		id: 'rose-pine',
		name: 'Rose Pine',
		description: 'All natural pine, faux fur and a bit of soho vibes',
		colors: {
			bg: '#191724',
			bgSecondary: '#1f1d2e',
			bgTertiary: '#26233a',
			fg: '#e0def4',
			fgSecondary: '#908caa',
			fgMuted: '#6e6a86',
			accent: '#c4a7e7',
			accentFg: '#191724',
			border: '#26233a',
			borderFocus: '#c4a7e7',
			qrFg: '#e0def4',
			qrBg: '#191724',
			error: '#eb6f92',
			success: '#9ccfd8'
		}
	},
	{
		id: 'gruvbox-dark',
		name: 'Gruvbox Dark',
		description: 'Retro groove color scheme',
		colors: {
			bg: '#282828',
			bgSecondary: '#3c3836',
			bgTertiary: '#504945',
			fg: '#ebdbb2',
			fgSecondary: '#d5c4a1',
			fgMuted: '#665c54',
			accent: '#fe8019',
			accentFg: '#282828',
			border: '#504945',
			borderFocus: '#fe8019',
			qrFg: '#ebdbb2',
			qrBg: '#282828',
			error: '#fb4934',
			success: '#b8bb26'
		}
	},
	{
		id: 'phosphor',
		name: 'Phosphor',
		description: 'Green-on-black terminal nostalgia',
		colors: {
			bg: '#0a0a0a',
			bgSecondary: '#141414',
			bgTertiary: '#1e1e1e',
			fg: '#33ff33',
			fgSecondary: '#29cc29',
			fgMuted: '#1a801a',
			accent: '#33ff33',
			accentFg: '#0a0a0a',
			border: '#1a331a',
			borderFocus: '#33ff33',
			qrFg: '#33ff33',
			qrBg: '#0a0a0a',
			error: '#ff3333',
			success: '#33ff33'
		}
	},
	{
		id: 'tokyo-night',
		name: 'Tokyo Night',
		description: 'A dark theme celebrating the lights of downtown Tokyo',
		colors: {
			bg: '#1a1b26',
			bgSecondary: '#24283b',
			bgTertiary: '#414868',
			fg: '#c0caf5',
			fgSecondary: '#a9b1d6',
			fgMuted: '#565f89',
			accent: '#7aa2f7',
			accentFg: '#1a1b26',
			border: '#414868',
			borderFocus: '#7aa2f7',
			qrFg: '#c0caf5',
			qrBg: '#1a1b26',
			error: '#f7768e',
			success: '#9ece6a'
		}
	},
	{
		id: 'paper',
		name: 'Paper',
		description: 'Clean ink on warm paper',
		colors: {
			bg: '#f5f0eb',
			bgSecondary: '#ebe5de',
			bgTertiary: '#ddd6cc',
			fg: '#2c2c2c',
			fgSecondary: '#454545',
			fgMuted: '#999088',
			accent: '#c25b3f',
			accentFg: '#f5f0eb',
			border: '#d4cdc4',
			borderFocus: '#c25b3f',
			qrFg: '#2c2c2c',
			qrBg: '#f5f0eb',
			error: '#c25b3f',
			success: '#5b8a3c'
		}
	}
];

export function getTheme(id: string): Theme {
	return themes.find((t) => t.id === id) ?? themes[0];
}

export function applyTheme(theme: Theme): void {
	const root = document.documentElement;
	for (const [key, value] of Object.entries(theme.colors)) {
		const cssVar = `--c-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
		root.style.setProperty(cssVar, value);
	}
	root.setAttribute('data-theme', theme.id);
}
