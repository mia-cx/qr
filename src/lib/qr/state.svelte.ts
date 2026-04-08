import { type PayloadType, type PayloadFields, defaultPayloads, encodePayload } from './payloads';
import type { ErrorCorrectionLevel, ModuleStyle } from './generate';
import {
	createDefaultQrDraft,
	loadPersistedQrDraft,
	persistQrDraft,
	type QRDraftSnapshot
} from './persistence';

const initialDraft = loadPersistedQrDraft();

class QRState {
	payloadType = $state<PayloadType>(initialDraft.payloadType);
	payloads = $state<PayloadFields>(initialDraft.payloads);

	errorCorrection = $state<ErrorCorrectionLevel>(initialDraft.errorCorrection);
	pixelSize = $state(initialDraft.pixelSize);
	moduleStyle = $state<ModuleStyle>(initialDraft.moduleStyle);
	fgColor = $state(initialDraft.fgColor);
	bgColor = $state(initialDraft.bgColor);
	logo = $state<string | undefined>(initialDraft.logo);
	frameText = $state(initialDraft.frameText);

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
			payloads: structuredClone(this.payloads),
			errorCorrection: this.errorCorrection,
			pixelSize: this.pixelSize,
			moduleStyle: this.moduleStyle,
			fgColor: this.fgColor,
			bgColor: this.bgColor,
			logo: this.logo,
			frameText: this.frameText
		};
	}

	private persist() {
		persistQrDraft(this.snapshot);
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
		this.payloads[type] = structuredClone(fields) as PayloadFields[T];
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

export const qrState = new QRState();
