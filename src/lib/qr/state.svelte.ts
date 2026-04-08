import { type PayloadType, type PayloadFields, defaultPayloads, encodePayload } from './payloads';
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
	capStyle = $state<CapStyle>('square');
	connectionMode = $state<ConnectionMode>('lines');
	dotSize = $state(1);
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
			capStyle: this.capStyle,
			connectionMode: this.connectionMode,
			dotSize: this.dotSize,
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
			capStyle: this.capStyle,
			connectionMode: this.connectionMode,
			dotSize: this.dotSize,
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
		this.capStyle = normalizeCapStyle(snapshot.capStyle, snapshot.pixelSize);
		this.connectionMode = snapshot.connectionMode;
		this.dotSize = normalizeDotSize(snapshot.dotSize, snapshot.pixelSize);
		this.fgColor = snapshot.fgColor;
		this.bgColor = snapshot.bgColor;
		this.logo = snapshot.logo;
		this.frameText = snapshot.frameText;
	}

	private persist() {
		this.isWritingToStore = true;
		try {
			try {
				this.store.set(this.snapshot);
			} catch (error) {
				// Persisting the draft is best-effort. Editing should still work
				// even if storage is unavailable or quota-limited.
				console.warn('Failed to persist QR draft', error);
			}
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
		this.capStyle = normalizeCapStyle(this.capStyle, size);
		this.dotSize = normalizeDotSize(this.dotSize, size);
		this.persist();
	}

	setModuleStyle(style: ModuleStyle) {
		this.moduleStyle = style;
		this.persist();
	}

	setCapStyle(style: CapStyle) {
		this.capStyle = normalizeCapStyle(style, this.pixelSize);
		this.persist();
	}

	setConnectionMode(mode: ConnectionMode) {
		this.connectionMode = mode;
		this.persist();
	}

	setDotSize(size: number) {
		const clamped = Math.min(
			Math.max(size, getMinimumPixelPerfectDotSize(this.pixelSize)),
			MAX_DOT_SIZE
		);
		this.dotSize = normalizeDotSize(clamped, this.pixelSize);
		this.persist();
	}

	setFgColor(color: string) {
		this.fgColor = color;
		this.persist();
	}

	setBgColor(color: string) {
		this.bgColor = color;
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
		this.capStyle = defaults.capStyle;
		this.connectionMode = defaults.connectionMode;
		this.dotSize = defaults.dotSize;
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
