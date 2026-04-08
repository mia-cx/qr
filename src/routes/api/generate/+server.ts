import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateQRSvg, type ErrorCorrectionLevel, type ModuleStyle, type QROptions } from '$lib/qr/generate';
import { encodePayload, type PayloadType, type PayloadFields, payloadLabels } from '$lib/qr/payloads';

export const GET: RequestHandler = async ({ url }) => {
	const data = url.searchParams.get('data');
	const type = url.searchParams.get('type') as PayloadType | null;

	if (!data && !type) {
		return json({
			usage: 'GET /api/generate?data=<string>&ec=<L|M|Q|H>&size=<number>&style=<square|rounded|dots|diamond>&fg=<hex>&bg=<hex>&frame=<text>',
			types: Object.keys(payloadLabels),
			examples: [
				'/api/generate?data=https://example.com',
				'/api/generate?data=https://example.com&ec=H&size=8&style=dots&fg=%23ffffff&bg=%23000000',
				'/api/generate?type=wifi&ssid=MyNetwork&password=secret123&encryption=WPA'
			]
		});
	}

	let qrData: string;

	if (type && type in payloadLabels) {
		const fields = buildPayloadFields(type, url.searchParams);
		qrData = encodePayload(type, fields);
	} else if (data) {
		qrData = data;
	} else {
		return error(400, 'Missing data or type parameter');
	}

	if (!qrData) {
		return error(400, 'Empty QR data');
	}

	const options: QROptions = {
		data: qrData,
		errorCorrection: (url.searchParams.get('ec') as ErrorCorrectionLevel) || 'M',
		pixelSize: Math.min(Math.max(parseInt(url.searchParams.get('size') || '6'), 1), 20),
		moduleStyle: (url.searchParams.get('style') as ModuleStyle) || 'square',
		fgColor: url.searchParams.get('fg') || '#000000',
		bgColor: url.searchParams.get('bg') || '#ffffff',
		frameText: url.searchParams.get('frame') || ''
	};

	const format = url.searchParams.get('format') || 'svg';

	const svg = generateQRSvg(options);

	if (format === 'json') {
		return json({ svg, data: qrData, options });
	}

	return new Response(svg, {
		headers: {
			'Content-Type': 'image/svg+xml',
			'Cache-Control': 'public, max-age=31536000, immutable'
		}
	});
};

function buildPayloadFields(type: PayloadType, params: URLSearchParams): PayloadFields[PayloadType] {
	switch (type) {
		case 'url':
			return { url: params.get('url') || params.get('data') || '' };
		case 'text':
			return { text: params.get('text') || params.get('data') || '' };
		case 'wifi':
			return {
				ssid: params.get('ssid') || '',
				password: params.get('password') || '',
				encryption: (params.get('encryption') as 'WPA' | 'WEP' | 'nopass') || 'WPA',
				hidden: params.get('hidden') === 'true'
			};
		case 'phone':
			return { number: params.get('number') || '' };
		case 'sms':
			return { number: params.get('number') || '', message: params.get('message') || '' };
		case 'email':
			return { to: params.get('to') || '', subject: params.get('subject') || '', body: params.get('body') || '' };
		case 'vcard':
			return {
				firstName: params.get('firstName') || '',
				lastName: params.get('lastName') || '',
				phone: params.get('phone') || '',
				email: params.get('email') || '',
				org: params.get('org') || '',
				title: params.get('title') || '',
				url: params.get('url') || '',
				address: params.get('address') || ''
			};
		case 'calendar':
			return {
				title: params.get('title') || '',
				location: params.get('location') || '',
				description: params.get('description') || '',
				start: params.get('start') || '',
				end: params.get('end') || ''
			};
		case 'geo':
			return { latitude: params.get('lat') || '', longitude: params.get('lng') || '' };
		case 'mecard':
			return {
				name: params.get('name') || '',
				phone: params.get('phone') || '',
				email: params.get('email') || '',
				url: params.get('url') || '',
				address: params.get('address') || '',
				note: params.get('note') || ''
			};
	}
}
