import { describe, expect, it } from 'vitest';

import {
	decodePayload,
	encodeCalendarPayload,
	encodePayload,
	encodeVcardPayload,
	getSafeExternalHref,
	normalizeLineEndingsForFile,
	type PayloadFields
} from './payloads';

describe('payload serialization', () => {
	it('reuses the escaped vCard serializer for QR payloads and file exports', () => {
		const fields: PayloadFields['vcard'] = {
			firstName: 'Jane, Jr.',
			lastName: 'Doe;Sr.',
			phone: '+31 6 1234 5678',
			email: 'jane@example.com',
			org: 'ACME\\Labs',
			title: 'Lead\nEngineer',
			url: 'https://example.com/a;b',
			address: 'Main St;\nSuite 2'
		};

		const content = encodeVcardPayload(fields);

		expect(content).toContain('N:Doe\\;Sr.;Jane\\, Jr.;;;');
		expect(content).toContain('ORG:ACME\\\\Labs');
		expect(content).toContain('TITLE:Lead\\nEngineer');
		expect(content).toContain('ADR:;;Main St\\;\\nSuite 2;;;;');
		expect(encodePayload('vcard', fields)).toBe(content);
		expect(normalizeLineEndingsForFile(content)).toContain('\r\nVERSION:3.0\r\n');
	});

	it('escapes calendar text fields before reuse in downloads', () => {
		const fields: PayloadFields['calendar'] = {
			title: 'Weekly sync; security',
			location: 'HQ, Room 3',
			description: 'Agenda line 1\nAgenda line 2',
			start: '2026-04-10T09:30',
			end: '2026-04-10T10:15'
		};

		const content = encodeCalendarPayload(fields);

		expect(content).toContain('SUMMARY:Weekly sync\\; security');
		expect(content).toContain('LOCATION:HQ\\, Room 3');
		expect(content).toContain('DESCRIPTION:Agenda line 1\\nAgenda line 2');
		expect(content).toContain('DTSTART:20260410T0930');
		expect(encodePayload('calendar', fields)).toBe(content);
	});

	it('preserves surrounding whitespace when decoding plain text payloads', () => {
		expect(decodePayload('  keep my spaces  ')).toEqual({
			type: 'text',
			fields: { text: '  keep my spaces  ' }
		});
	});
});

describe('getSafeExternalHref', () => {
	it('allows only http and https links', () => {
		expect(getSafeExternalHref('https://mia.cx')).toBe('https://mia.cx/');
		expect(getSafeExternalHref('www.mia.cx')).toBe('https://www.mia.cx/');
		expect(getSafeExternalHref('javascript:alert(1)')).toBeNull();
		expect(getSafeExternalHref('intent://open')).toBeNull();
	});
});
