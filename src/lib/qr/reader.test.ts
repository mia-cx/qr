import { beforeEach, describe, expect, it, vi } from 'vitest';

import jsQR from 'jsqr';

import { constrainImageDimensions, readQRFromFile, readQRFromImageData } from './reader';

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

	it('rejects oversized files before decoding them', async () => {
		const oversized = new File([new Uint8Array(12 * 1024 * 1024 + 1)], 'huge.png', {
			type: 'image/png'
		});

		await expect(readQRFromFile(oversized)).resolves.toEqual({
			data: '',
			success: false,
			error: 'Image is too large to scan safely'
		});
	});
});

describe('constrainImageDimensions', () => {
	it('downscales images that exceed the pixel budget while preserving aspect ratio', () => {
		expect(constrainImageDimensions(4000, 4000)).toEqual({ width: 2000, height: 2000 });
		expect(constrainImageDimensions(8000, 2000)).toEqual({ width: 4000, height: 1000 });
	});
});
