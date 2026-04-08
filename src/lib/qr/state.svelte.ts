import { type PayloadType, type PayloadFields, defaultPayloads, encodePayload } from './payloads';
import type { ErrorCorrectionLevel, ModuleStyle } from './generate';
import {
	createDefaultQrDraft,
	type QRDraftStore,
	qrDraftStore,
	type QRDraftSnapshot
} from './persistence';

export class QRState {
	private isWritingToStore = false;
	private readonly store: QRDraftStore;

	payloadType = $state<PayloadType>('url');
	payloads = $state<PayloadFields>(structuredClone(defaultPayloads));

	errorCorrection = $state<ErrorCorrectionLevel>('M');
	pixelSize = $state(6);
	moduleStyle = $state<ModuleStyle>('square');
	fgColor = $state('#000000');
	bgColor = $state('#ffffff');
	logo = $state<string | undefined>(undefined);
	frameText = $state('');

	constructor(store: QRDraftStore = qrDraftStore) {
		this.store = store;
		this.applySnapshot(this.store.get());

		this.store.listen((snapshot) => {
			if (this.isWritingToStore) {
				return;
			}

			this.applySnapshot(snapshot);
		});
	}

	get currentPayload() {
		return this.payloads[this.payloadType];
	}

	get encodedData(): string {
		return encodePayload(this.payloadType, this.payloads[this.payloadType]);
	}

	getCurrentQrOptions() {
		return {
			data: this.encodedData,
			errorCorrection: this.errorCorrection,
			pixelSize: this.pixelSize,
			moduleStyle: this.moduleStyle,
			fgColor: this.fgColor,
			bgColor: this.bgColor,
			logo: this.logo,
			frameText: this.frameText
		};
	}

	get snapshot(): QRDraftSnapshot {
		return {
			payloadType: this.payloadType,
			payloads: $state.snapshot(this.payloads),
			errorCorrection: this.errorCorrection,
			pixelSize: this.pixelSize,
			moduleStyle: this.moduleStyle,
			fgColor: this.fgColor,
			bgColor: this.bgColor,
			logo: this.logo,
			frameText: this.frameText
		};
	}

	private applySnapshot(snapshot: QRDraftSnapshot) {
		this.payloadType = snapshot.payloadType;
		this.payloads = structuredClone(snapshot.payloads);
		this.errorCorrection = snapshot.errorCorrection;
		this.pixelSize = snapshot.pixelSize;
		this.moduleStyle = snapshot.moduleStyle;
		this.fgColor = snapshot.fgColor;
		this.bgColor = snapshot.bgColor;
		this.logo = snapshot.logo;
		this.frameText = snapshot.frameText;
	}

	private persist() {
		this.isWritingToStore = true;
		try {
			this.store.set(this.snapshot);
		} finally {
			this.isWritingToStore = false;
		}
	}

	setPayloadType(type: PayloadType) {
		this.payloadType = type;
		this.persist();
	}

	setPayloadField<T extends PayloadType>(
		type: T,
		field: keyof PayloadFields[T],
		value: string | boolean
	) {
		(this.payloads[type] as Record<string, string | boolean>)[field as string] = value;
		this.persist();
	}

	setAutoDetectedPrimaryValue(type: Extract<PayloadType, 'url' | 'text' | 'phone'>, value: string) {
		this.payloadType = type;
		this.payloads.url.url = value;
		this.payloads.text.text = value;
		this.payloads.phone.number = value;
		this.persist();
	}

	replacePayload<T extends PayloadType>(type: T, fields: PayloadFields[T]) {
		this.payloadType = type;
		this.payloads[type] = $state.snapshot(fields) as PayloadFields[T];
		this.persist();
	}

	setErrorCorrection(level: ErrorCorrectionLevel) {
		this.errorCorrection = level;
		this.persist();
	}

	setPixelSize(size: number) {
		this.pixelSize = size;
		this.persist();
	}

	applyThemeColors(fg: string, bg: string) {
		this.fgColor = fg;
		this.bgColor = bg;
		this.persist();
	}

	reset() {
		const defaults = createDefaultQrDraft();
		this.payloadType = defaults.payloadType;
		this.payloads = structuredClone(defaultPayloads);
		this.errorCorrection = defaults.errorCorrection;
		this.pixelSize = defaults.pixelSize;
		this.moduleStyle = defaults.moduleStyle;
		this.fgColor = defaults.fgColor;
		this.bgColor = defaults.bgColor;
		this.logo = defaults.logo;
		this.frameText = defaults.frameText;
		this.persist();
	}
}

export function createQrState(store?: QRDraftStore) {
	return new QRState(store);
}

export const qrState = createQrState();
