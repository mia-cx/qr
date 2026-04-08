export type PayloadType =
	| 'url'
	| 'text'
	| 'wifi'
	| 'phone'
	| 'sms'
	| 'email'
	| 'vcard'
	| 'calendar'
	| 'geo'
	| 'mecard';

export interface PayloadFields {
	url: { url: string };
	text: { text: string };
	wifi: { ssid: string; password: string; encryption: 'WPA' | 'WEP' | 'nopass'; hidden: boolean };
	phone: { number: string };
	sms: { number: string; message: string };
	email: { to: string; subject: string; body: string };
	vcard: {
		firstName: string;
		lastName: string;
		phone: string;
		email: string;
		org: string;
		title: string;
		url: string;
		address: string;
	};
	calendar: {
		title: string;
		location: string;
		description: string;
		start: string;
		end: string;
	};
	geo: { latitude: string; longitude: string };
	mecard: {
		name: string;
		phone: string;
		email: string;
		url: string;
		address: string;
		note: string;
	};
}

export const payloadLabels: Record<PayloadType, string> = {
	url: 'URL',
	text: 'Text',
	wifi: 'WiFi',
	phone: 'Phone',
	sms: 'SMS',
	email: 'Email',
	vcard: 'vCard',
	calendar: 'Calendar Event',
	geo: 'Geo Location',
	mecard: 'MeCard'
};

export const defaultPayloads: PayloadFields = {
	url: { url: '' },
	text: { text: '' },
	wifi: { ssid: '', password: '', encryption: 'WPA', hidden: false },
	phone: { number: '' },
	sms: { number: '', message: '' },
	email: { to: '', subject: '', body: '' },
	vcard: {
		firstName: '',
		lastName: '',
		phone: '',
		email: '',
		org: '',
		title: '',
		url: '',
		address: ''
	},
	calendar: { title: '', location: '', description: '', start: '', end: '' },
	geo: { latitude: '', longitude: '' },
	mecard: { name: '', phone: '', email: '', url: '', address: '', note: '' }
};

export function decodePayload(raw: string): { type: PayloadType; fields: PayloadFields[PayloadType] } {
	// WiFi
	if (raw.startsWith('WIFI:')) {
		const get = (key: string) => {
			const m = raw.match(new RegExp(`${key}:((?:[^\\\\;]|\\\\.)*)`));
			return m?.[1]?.replace(/\\(.)/g, '$1') ?? '';
		};
		return {
			type: 'wifi',
			fields: {
				ssid: get('S'),
				password: get('P'),
				encryption: (get('T') || 'WPA') as 'WPA' | 'WEP' | 'nopass',
				hidden: get('H') === 'true'
			}
		};
	}

	// vCard
	if (raw.startsWith('BEGIN:VCARD')) {
		const line = (key: string) => {
			const m = raw.match(new RegExp(`^${key}(?:;[^:]*)?:(.*)$`, 'm'));
			return m?.[1]?.replace(/\\(.)/g, '$1') ?? '';
		};
		const n = line('N').split(';');
		return {
			type: 'vcard',
			fields: {
				lastName: n[0] ?? '',
				firstName: n[1] ?? '',
				phone: line('TEL'),
				email: line('EMAIL'),
				org: line('ORG'),
				title: line('TITLE'),
				url: line('URL'),
				address: line('ADR').replace(/^;;/, '').replace(/;+$/, '')
			}
		};
	}

	// Calendar
	if (raw.startsWith('BEGIN:VCALENDAR')) {
		const line = (key: string) => {
			const m = raw.match(new RegExp(`^${key}(?:;[^:]*)?:(.*)$`, 'm'));
			return m?.[1] ?? '';
		};
		const parseDt = (dt: string) => {
			// 20260421T120000Z -> 2026-04-21T12:00
			return dt.replace(
				/(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?(\d{2})?Z?/,
				(_, y, mo, day, h, mi) => `${y}-${mo}-${day}T${h ?? '00'}:${mi ?? '00'}`
			);
		};
		return {
			type: 'calendar',
			fields: {
				title: line('SUMMARY'),
				location: line('LOCATION'),
				description: line('DESCRIPTION'),
				start: parseDt(line('DTSTART')),
				end: parseDt(line('DTEND'))
			}
		};
	}

	// MeCard
	if (raw.startsWith('MECARD:')) {
		const get = (key: string) => {
			const m = raw.match(new RegExp(`${key}:((?:[^\\\\;]|\\\\.)*)`));
			return m?.[1]?.replace(/\\(.)/g, '$1') ?? '';
		};
		return {
			type: 'mecard',
			fields: {
				name: get('N'),
				phone: get('TEL'),
				email: get('EMAIL'),
				url: get('URL'),
				address: get('ADR'),
				note: get('NOTE')
			}
		};
	}

	// Geo
	if (raw.startsWith('geo:')) {
		const coords = raw.slice(4).split(',');
		return {
			type: 'geo',
			fields: { latitude: coords[0] ?? '', longitude: coords[1] ?? '' }
		};
	}

	// Phone
	if (raw.startsWith('tel:')) {
		return { type: 'phone', fields: { number: raw.slice(4) } };
	}

	// SMS
	if (raw.startsWith('smsto:')) {
		const parts = raw.slice(6).split(':');
		return {
			type: 'sms',
			fields: { number: parts[0] ?? '', message: parts.slice(1).join(':') }
		};
	}

	// Email
	if (raw.startsWith('mailto:')) {
		const [to, query] = raw.slice(7).split('?');
		const params = new URLSearchParams(query ?? '');
		return {
			type: 'email',
			fields: {
				to: to ?? '',
				subject: params.get('subject') ?? '',
				body: params.get('body') ?? ''
			}
		};
	}

	// URL
	if (/^https?:\/\//i.test(raw) || raw.startsWith('www.')) {
		return { type: 'url', fields: { url: raw } };
	}

	// Fallback: plain text
	return { type: 'text', fields: { text: raw } };
}

function escapeWifi(s: string): string {
	return s.replace(/([\\;,:"'])/g, '\\$1');
}

function escapeVcard(s: string): string {
	return s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');
}

function escapeICalendarText(s: string): string {
	return s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');
}

function formatCalendarDateTime(value: string): string {
	return value.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function encodeVcardPayload(fields: PayloadFields['vcard']): string {
	const lines = [
		'BEGIN:VCARD',
		'VERSION:3.0',
		`N:${escapeVcard(fields.lastName)};${escapeVcard(fields.firstName)};;;`,
		`FN:${escapeVcard([fields.firstName, fields.lastName].filter(Boolean).join(' '))}`
	];

	if (fields.phone) lines.push(`TEL:${escapeVcard(fields.phone)}`);
	if (fields.email) lines.push(`EMAIL:${escapeVcard(fields.email)}`);
	if (fields.org) lines.push(`ORG:${escapeVcard(fields.org)}`);
	if (fields.title) lines.push(`TITLE:${escapeVcard(fields.title)}`);
	if (fields.url) lines.push(`URL:${escapeVcard(fields.url)}`);
	if (fields.address) lines.push(`ADR:;;${escapeVcard(fields.address)};;;;`);

	lines.push('END:VCARD');
	return lines.join('\n');
}

export function encodeCalendarPayload(fields: PayloadFields['calendar']): string {
	const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT'];

	if (fields.title) lines.push(`SUMMARY:${escapeICalendarText(fields.title)}`);
	if (fields.start) lines.push(`DTSTART:${formatCalendarDateTime(fields.start)}`);
	if (fields.end) lines.push(`DTEND:${formatCalendarDateTime(fields.end)}`);
	if (fields.location) lines.push(`LOCATION:${escapeICalendarText(fields.location)}`);
	if (fields.description) lines.push(`DESCRIPTION:${escapeICalendarText(fields.description)}`);

	lines.push('END:VEVENT', 'END:VCALENDAR');
	return lines.join('\n');
}

export function normalizeLineEndingsForFile(content: string): string {
	return content.replace(/\r?\n/g, '\r\n');
}

export function getSafeExternalHref(value: string): string | null {
	if (!value) return null;

	try {
		const normalized = value.startsWith('www.') ? `https://${value}` : value;
		const url = new URL(normalized);
		return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
	} catch {
		return null;
	}
}

const PHONE_RE = /^[\d+\s()\-.*#]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+$/;
const GEO_RE = /^-?\d+(\.\d+)?$/;

export function getSafePhoneHref(value: string): string | null {
	return PHONE_RE.test(value.trim()) ? `tel:${value.trim()}` : null;
}

export function getSafeSmsHref(value: string): string | null {
	return PHONE_RE.test(value.trim()) ? `sms:${value.trim()}` : null;
}

export function getSafeMailtoHref(value: string): string | null {
	return EMAIL_RE.test(value.trim()) ? `mailto:${value.trim()}` : null;
}

export function getSafeGeoHref(lat: string, lon: string): string | null {
	return GEO_RE.test(lat.trim()) && GEO_RE.test(lon.trim())
		? `geo:${lat.trim()},${lon.trim()}`
		: null;
}

export function encodePayload(type: PayloadType, fields: PayloadFields[typeof type]): string {
	switch (type) {
		case 'url': {
			const f = fields as PayloadFields['url'];
			return f.url;
		}
		case 'text': {
			const f = fields as PayloadFields['text'];
			return f.text;
		}
		case 'wifi': {
			const f = fields as PayloadFields['wifi'];
			const hidden = f.hidden ? 'H:true' : '';
			return `WIFI:T:${f.encryption};S:${escapeWifi(f.ssid)};P:${escapeWifi(f.password)};${hidden};`;
		}
		case 'phone': {
			const f = fields as PayloadFields['phone'];
			return `tel:${f.number}`;
		}
		case 'sms': {
			const f = fields as PayloadFields['sms'];
			return `smsto:${f.number}:${f.message}`;
		}
		case 'email': {
			const f = fields as PayloadFields['email'];
			return `mailto:${f.to}?subject=${encodeURIComponent(f.subject)}&body=${encodeURIComponent(f.body)}`;
		}
		case 'vcard': {
			return encodeVcardPayload(fields as PayloadFields['vcard']);
		}
		case 'calendar': {
			return encodeCalendarPayload(fields as PayloadFields['calendar']);
		}
		case 'geo': {
			const f = fields as PayloadFields['geo'];
			return `geo:${f.latitude},${f.longitude}`;
		}
		case 'mecard': {
			const f = fields as PayloadFields['mecard'];
			let s = `MECARD:N:${escapeWifi(f.name)};`;
			if (f.phone) s += `TEL:${escapeWifi(f.phone)};`;
			if (f.email) s += `EMAIL:${escapeWifi(f.email)};`;
			if (f.url) s += `URL:${escapeWifi(f.url)};`;
			if (f.address) s += `ADR:${escapeWifi(f.address)};`;
			if (f.note) s += `NOTE:${escapeWifi(f.note)};`;
			s += ';';
			return s;
		}
	}
}
