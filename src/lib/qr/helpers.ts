import type { PayloadType } from './payloads';
import type { CapStyle, ConnectionMode } from './generate';

export function normalizeHexColor(value: string): string | null {
	const trimmed = value.trim();
	const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
	const hex = withHash.slice(1);

	if (!/^[\da-fA-F]{3}$|^[\da-fA-F]{6}$/.test(hex)) {
		return null;
	}

	if (hex.length === 3) {
		const expanded = hex
			.split('')
			.map((char) => char + char)
			.join('');
		return `#${expanded.toUpperCase()}`;
	}

	return `#${hex.toUpperCase()}`;
}

export function getCornerShapePath(capStyle: CapStyle): string {
	switch (capStyle) {
		case 'square':
			return 'M2.5 2.5H13.5V13.5H2.5Z';
		case 'circle':
			return 'M8 2.5H13.5V13.5H2.5V8A5.5 5.5 0 0 1 8 2.5Z';
		case 'miter':
			return 'M8 2.5H13.5V13.5H2.5V8Z';
	}
}

export function getConnectionModeDots(connectionMode: ConnectionMode) {
	return connectionMode === 'lines'
		? [
				{ cx: 4, cy: 4 },
				{ cx: 12, cy: 4 },
				{ cx: 12, cy: 12 },
				{ cx: 4, cy: 12 }
			]
		: [
				{ cx: 4, cy: 4 },
				{ cx: 12, cy: 4 },
				{ cx: 4, cy: 12 },
				{ cx: 12, cy: 12 }
			];
}

export function getConnectionModePath(connectionMode: ConnectionMode): string | null {
	return connectionMode === 'lines' ? 'M4 4H12V12' : null;
}

export function getPrimaryPlaceholder(type: PayloadType): string {
	const map: Partial<Record<PayloadType, string>> = {
		url: 'https://example.com',
		text: 'Enter text...',
		phone: '+1 234 567 8900',
		email: 'recipient@example.com',
		wifi: 'Network name (SSID)',
		sms: 'Phone number',
		vcard: 'First name',
		calendar: 'Event title',
		geo: 'Latitude',
		mecard: 'Name'
	};
	return map[type] ?? 'Enter data...';
}

export function getPrimaryLabel(type: PayloadType): string {
	const map: Partial<Record<PayloadType, string>> = {
		url: 'URL',
		text: 'Text',
		phone: 'Phone number'
	};
	return map[type] ?? 'QR content';
}
