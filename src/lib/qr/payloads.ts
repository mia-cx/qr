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
			const m = raw.match(new RegExp(`${key}:([^;]*)`));
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
			const m = raw.match(new RegExp(`^${key}:(.*)$`, 'm'));
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
			const m = raw.match(new RegExp(`^${key}:(.*)$`, 'm'));
			return m?.[1] ?? '';
		};
		const parseDt = (dt: string) => {
			// 20260421T0000 -> 2026-04-21T00:00
			const d = dt.replace(/(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?/, (_, y, mo, day, h, mi) =>
				`${y}-${mo}-${day}T${h ?? '00'}:${mi ?? '00'}`
			);
			return d;
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
			const m = raw.match(new RegExp(`${key}:([^;]*)`));
			return m?.[1] ?? '';
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
	return s.replace(/([,;\\])/g, '\\$1');
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
			const f = fields as PayloadFields['vcard'];
			const lines = [
				'BEGIN:VCARD',
				'VERSION:3.0',
				`N:${escapeVcard(f.lastName)};${escapeVcard(f.firstName)};;;`,
				`FN:${escapeVcard(f.firstName)} ${escapeVcard(f.lastName)}`
			];
			if (f.phone) lines.push(`TEL:${f.phone}`);
			if (f.email) lines.push(`EMAIL:${f.email}`);
			if (f.org) lines.push(`ORG:${escapeVcard(f.org)}`);
			if (f.title) lines.push(`TITLE:${escapeVcard(f.title)}`);
			if (f.url) lines.push(`URL:${f.url}`);
			if (f.address) lines.push(`ADR:;;${escapeVcard(f.address)};;;;`);
			lines.push('END:VCARD');
			return lines.join('\n');
		}
		case 'calendar': {
			const f = fields as PayloadFields['calendar'];
			const fmt = (d: string) => d.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
			const lines = [
				'BEGIN:VCALENDAR',
				'BEGIN:VEVENT',
				`SUMMARY:${f.title}`,
				`DTSTART:${fmt(f.start)}`,
				`DTEND:${fmt(f.end)}`
			];
			if (f.location) lines.push(`LOCATION:${f.location}`);
			if (f.description) lines.push(`DESCRIPTION:${f.description}`);
			lines.push('END:VEVENT', 'END:VCALENDAR');
			return lines.join('\n');
		}
		case 'geo': {
			const f = fields as PayloadFields['geo'];
			return `geo:${f.latitude},${f.longitude}`;
		}
		case 'mecard': {
			const f = fields as PayloadFields['mecard'];
			let s = `MECARD:N:${f.name};`;
			if (f.phone) s += `TEL:${f.phone};`;
			if (f.email) s += `EMAIL:${f.email};`;
			if (f.url) s += `URL:${f.url};`;
			if (f.address) s += `ADR:${f.address};`;
			if (f.note) s += `NOTE:${f.note};`;
			s += ';';
			return s;
		}
	}
}
