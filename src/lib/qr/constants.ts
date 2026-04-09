import type { ErrorCorrectionLevel, CapStyle, ConnectionMode } from './generate';

export const SUGGESTED_PIXEL_SIZES = [1, 3, 8, 16, 32];

export const EC_LEVELS: { value: ErrorCorrectionLevel; label: string; pct: string }[] = [
	{ value: 'L', label: 'L', pct: '7%' },
	{ value: 'M', label: 'M', pct: '15%' },
	{ value: 'Q', label: 'Q', pct: '25%' },
	{ value: 'H', label: 'H', pct: '30%' }
];

export const EC_VALUES: ErrorCorrectionLevel[] = ['L', 'M', 'Q', 'H'];

export const WIFI_ENCRYPTION_VALUES = ['WPA', 'WEP', 'nopass'] as const;

export const CAP_STYLE_VALUES: CapStyle[] = ['square', 'circle', 'miter'];

export const CAP_STYLE_LABELS: Record<CapStyle, string> = {
	square: 'Square corner',
	circle: 'Rounded corner',
	miter: 'Mitered corner'
};

export const CONNECTION_MODE_VALUES: ConnectionMode[] = ['disconnected', 'lines'];

export const CONNECTION_MODE_LABELS: Record<ConnectionMode, string> = {
	disconnected: 'Separated dots',
	lines: 'Unioned dots'
};

export const SIMPLE_PAYLOAD_TYPES = ['url', 'text', 'phone'] as const;

export const AUTO_DETECT_PATTERNS = {
	url: /^(https?:\/\/|www\.)/i,
	whitespace: /\s/,
	phone: /^\+?[\d\s\-().]{7,}$/
} as const;
