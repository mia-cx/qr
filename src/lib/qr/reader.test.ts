import { beforeEach, describe, expect, it, vi } from 'vitest';

import jsQR from 'jsqr';

import { readQRFromImageData } from './reader';

vi.mock('jsqr', () => ({
	default: vi.fn()
}));

const mockedJsQR = vi.mocked(jsQR);

describe('readQRFromImageData', () => {
	const imageData = {
		data: new Uint8ClampedArray(4),
		width: 1,
		height: 1
	} as ImageData;

	beforeEach(() => {
		mockedJsQR.mockReset();
	});

	it('returns decoded data when jsQR finds a code', () => {
		mockedJsQR.mockReturnValue({
			data: 'https://mia.cx'
		} as ReturnType<typeof jsQR>);

		expect(readQRFromImageData(imageData)).toEqual({
			data: 'https://mia.cx',
			success: true
		});
	});

	it('returns a friendly error when no code is found', () => {
		mockedJsQR.mockReturnValue(null);

		expect(readQRFromImageData(imageData)).toEqual({
			data: '',
			success: false,
			error: 'No QR code found in image'
		});
	});
});
