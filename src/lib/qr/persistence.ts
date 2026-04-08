import { persistentAtom } from '@nanostores/persistent';

import {
	MAX_DOT_SIZE,
	getMinimumPixelPerfectDotSize,
	normalizeCapStyle,
	normalizeDotSize,
	type ErrorCorrectionLevel,
	type ModuleStyle,
	type CapStyle,
	type ConnectionMode
} from './generate';
import { defaultPayloads, type PayloadFields, type PayloadType } from './payloads';

export const QR_DRAFT_STORAGE_KEY = 'qr-draft';

export interface QRDraftSnapshot {
	payloadType: PayloadType;
	payloads: PayloadFields;
	errorCorrection: ErrorCorrectionLevel;
	pixelSize: number;
	moduleStyle: ModuleStyle;
	capStyle: CapStyle;
	connectionMode: ConnectionMode;
	dotSize: number;
	fgColor: string;
	bgColor: string;
	logo?: string;
	frameText: string;
}

const PAYLOAD_TYPES: PayloadType[] = [
	'url',
	'text',
	'wifi',
	'phone',
	'sms',
	'email',
	'vcard',
	'calendar',
	'geo',
	'mecard'
];
const ERROR_CORRECTION_VALUES: ErrorCorrectionLevel[] = ['L', 'M', 'Q', 'H'];
const MODULE_STYLE_VALUES: ModuleStyle[] = ['square', 'rounded', 'dots', 'diamond'];
const CAP_STYLE_VALUES: CapStyle[] = ['square', 'circle', 'miter'];
const CONNECTION_MODE_VALUES: ConnectionMode[] = ['disconnected', 'lines'];

function getRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown, fallback = ''): string {
	return typeof value === 'string' ? value : fallback;
}

function readBoolean(value: unknown, fallback = false): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

function readEnum<T extends string>(value: unknown, choices: readonly T[], fallback: T): T {
	return typeof value === 'string' && choices.includes(value as T) ? (value as T) : fallback;
}

function cloneDefaultPayloads(): PayloadFields {
	return structuredClone(defaultPayloads);
}

function normalizePayloads(value: unknown): PayloadFields {
	const defaults = cloneDefaultPayloads();
	const record = getRecord(value);

	if (!record) {
		return defaults;
	}

	const url = getRecord(record.url);
	const text = getRecord(record.text);
	const wifi = getRecord(record.wifi);
	const phone = getRecord(record.phone);
	const sms = getRecord(record.sms);
	const email = getRecord(record.email);
	const vcard = getRecord(record.vcard);
	const calendar = getRecord(record.calendar);
	const geo = getRecord(record.geo);
	const mecard = getRecord(record.mecard);

	return {
		url: {
			url: readString(url?.url, defaults.url.url)
		},
		text: {
			text: readString(text?.text, defaults.text.text)
		},
		wifi: {
			ssid: readString(wifi?.ssid, defaults.wifi.ssid),
			password: readString(wifi?.password, defaults.wifi.password),
			encryption: readEnum(wifi?.encryption, ['WPA', 'WEP', 'nopass'], defaults.wifi.encryption),
			hidden: readBoolean(wifi?.hidden, defaults.wifi.hidden)
		},
		phone: {
			number: readString(phone?.number, defaults.phone.number)
		},
		sms: {
			number: readString(sms?.number, defaults.sms.number),
			message: readString(sms?.message, defaults.sms.message)
		},
		email: {
			to: readString(email?.to, defaults.email.to),
			subject: readString(email?.subject, defaults.email.subject),
			body: readString(email?.body, defaults.email.body)
		},
		vcard: {
			firstName: readString(vcard?.firstName, defaults.vcard.firstName),
			lastName: readString(vcard?.lastName, defaults.vcard.lastName),
			phone: readString(vcard?.phone, defaults.vcard.phone),
			email: readString(vcard?.email, defaults.vcard.email),
			org: readString(vcard?.org, defaults.vcard.org),
			title: readString(vcard?.title, defaults.vcard.title),
			url: readString(vcard?.url, defaults.vcard.url),
			address: readString(vcard?.address, defaults.vcard.address)
		},
		calendar: {
			title: readString(calendar?.title, defaults.calendar.title),
			location: readString(calendar?.location, defaults.calendar.location),
			description: readString(calendar?.description, defaults.calendar.description),
			start: readString(calendar?.start, defaults.calendar.start),
			end: readString(calendar?.end, defaults.calendar.end)
		},
		geo: {
			latitude: readString(geo?.latitude, defaults.geo.latitude),
			longitude: readString(geo?.longitude, defaults.geo.longitude)
		},
		mecard: {
			name: readString(mecard?.name, defaults.mecard.name),
			phone: readString(mecard?.phone, defaults.mecard.phone),
			email: readString(mecard?.email, defaults.mecard.email),
			url: readString(mecard?.url, defaults.mecard.url),
			address: readString(mecard?.address, defaults.mecard.address),
			note: readString(mecard?.note, defaults.mecard.note)
		}
	};
}

export function createDefaultQrDraft(): QRDraftSnapshot {
	return {
		payloadType: 'url',
		payloads: cloneDefaultPayloads(),
		errorCorrection: 'M',
		pixelSize: 6,
		moduleStyle: 'square',
		capStyle: 'square',
		connectionMode: 'lines',
		dotSize: 1,
		fgColor: '#000000',
		bgColor: '#ffffff',
		logo: undefined,
		frameText: ''
	};
}

export function normalizeQrDraft(value: unknown): QRDraftSnapshot {
	const defaults = createDefaultQrDraft();
	const record = getRecord(value);

	if (!record) {
		return defaults;
	}

	const pixelSize =
		typeof record.pixelSize === 'number' &&
		Number.isFinite(record.pixelSize) &&
		record.pixelSize > 0
			? record.pixelSize
			: defaults.pixelSize;

	const dotSize =
		typeof record.dotSize === 'number' &&
		Number.isFinite(record.dotSize) &&
		record.dotSize >= getMinimumPixelPerfectDotSize(pixelSize) &&
		record.dotSize <= MAX_DOT_SIZE
			? normalizeDotSize(record.dotSize, pixelSize)
			: defaults.dotSize;

	return {
		payloadType: readEnum(record.payloadType, PAYLOAD_TYPES, defaults.payloadType),
		payloads: normalizePayloads(record.payloads),
		errorCorrection: readEnum(
			record.errorCorrection,
			ERROR_CORRECTION_VALUES,
			defaults.errorCorrection
		),
		pixelSize: pixelSize,
		moduleStyle: readEnum(record.moduleStyle, MODULE_STYLE_VALUES, defaults.moduleStyle),
		capStyle: normalizeCapStyle(
			readEnum(record.capStyle, CAP_STYLE_VALUES, defaults.capStyle),
			pixelSize
		),
		connectionMode: readEnum(
			record.connectionMode,
			CONNECTION_MODE_VALUES,
			defaults.connectionMode
		),
		dotSize,
		fgColor: readString(record.fgColor, defaults.fgColor),
		bgColor: readString(record.bgColor, defaults.bgColor),
		logo: typeof record.logo === 'string' && record.logo ? record.logo : undefined,
		frameText: readString(record.frameText, defaults.frameText)
	};
}

function decodeQrDraft(raw: string): QRDraftSnapshot {
	try {
		return normalizeQrDraft(JSON.parse(raw));
	} catch {
		return createDefaultQrDraft();
	}
}

export function createQrDraftStore(key = QR_DRAFT_STORAGE_KEY) {
	return persistentAtom<QRDraftSnapshot>(key, createDefaultQrDraft(), {
		encode: (snapshot) => JSON.stringify(normalizeQrDraft(snapshot)),
		decode: decodeQrDraft
	});
}

export type QRDraftStore = ReturnType<typeof createQrDraftStore>;

export const qrDraftStore = createQrDraftStore();
