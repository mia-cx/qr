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
