import { type PayloadType, type PayloadFields, defaultPayloads, encodePayload } from './payloads';
import type { ErrorCorrectionLevel, ModuleStyle } from './generate';

class QRState {
	payloadType = $state<PayloadType>('url');
	payloads = $state<PayloadFields>(structuredClone(defaultPayloads));

	errorCorrection = $state<ErrorCorrectionLevel>('M');
	pixelSize = $state(6);
	moduleStyle = $state<ModuleStyle>('square');
	fgColor = $state('#000000');
	bgColor = $state('#ffffff');
	logo = $state<string | undefined>(undefined);
	frameText = $state('');

	get currentPayload() {
		return this.payloads[this.payloadType];
	}

	get encodedData(): string {
		return encodePayload(this.payloadType, this.payloads[this.payloadType]);
	}

	get qrOptions() {
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

	setPayloadField<T extends PayloadType>(
		type: T,
		field: keyof PayloadFields[T],
		value: string | boolean
	) {
		(this.payloads[type] as Record<string, string | boolean>)[field as string] = value;
	}

	applyThemeColors(fg: string, bg: string) {
		this.fgColor = fg;
		this.bgColor = bg;
	}

	reset() {
		this.payloads = structuredClone(defaultPayloads);
		this.errorCorrection = 'M';
		this.pixelSize = 6;
		this.moduleStyle = 'square';
		this.fgColor = '#000000';
		this.bgColor = '#ffffff';
		this.logo = undefined;
		this.frameText = '';
	}
}

export const qrState = new QRState();
