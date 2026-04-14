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

	it('retries with center-sampled modules when reduced dots confuse the direct decode', () => {
		const reducedDotImage = createReducedDotQrImage();

		mockedJsQR
			.mockReturnValueOnce(null)
			.mockReturnValueOnce({ data: 'recovered-from-center-sampling' } as ReturnType<typeof jsQR>);

		expect(readQRFromImageData(reducedDotImage as ImageData)).toEqual({
			data: 'recovered-from-center-sampling',
			success: true
		});
		expect(mockedJsQR).toHaveBeenCalledTimes(2);
		expect(mockedJsQR.mock.calls[1]?.[1]).toBeGreaterThan(reducedDotImage.width);
		expect(mockedJsQR.mock.calls[1]?.[2]).toBeGreaterThan(reducedDotImage.height);
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

function createReducedDotQrImage() {
	const moduleCount = 21;
	const moduleSize = 4;
	const width = moduleCount * moduleSize;
	const height = width;
	const data = new Uint8ClampedArray(width * height * 4);
	data.fill(255);

	for (let row = 0; row < moduleCount; row++) {
		for (let col = 0; col < moduleCount; col++) {
			const isDark =
				row === 0 ||
				col === 0 ||
				row === moduleCount - 1 ||
				col === moduleCount - 1 ||
				(row >= 2 && row <= 4 && col >= 2 && col <= 4) ||
				(row >= 2 && row <= 4 && col >= moduleCount - 5 && col <= moduleCount - 3) ||
				(row >= moduleCount - 5 && row <= moduleCount - 3 && col >= 2 && col <= 4);

			if (!isDark) {
				continue;
			}

			const startX = col * moduleSize + 1;
			const startY = row * moduleSize + 1;
			for (let y = 0; y < 2; y++) {
				for (let x = 0; x < 2; x++) {
					const offset = ((startY + y) * width + startX + x) * 4;
					data[offset] = 0;
					data[offset + 1] = 0;
					data[offset + 2] = 0;
					data[offset + 3] = 255;
				}
			}
		}
	}

	return { data, width, height };
}

describe('constrainImageDimensions', () => {
	it('downscales images that exceed the pixel budget while preserving aspect ratio', () => {
		expect(constrainImageDimensions(4000, 4000)).toEqual({ width: 2000, height: 2000 });
		expect(constrainImageDimensions(8000, 2000)).toEqual({ width: 4000, height: 1000 });
	});
});
