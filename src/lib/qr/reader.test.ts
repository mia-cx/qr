import { beforeEach, describe, expect, it, vi } from 'vitest';

import jsQR from 'jsqr';

import { constrainImageDimensions, dilateDark, readQRFromFile, readQRFromImageData } from './reader';

vi.mock('jsqr', () => ({
	default: vi.fn()
}));

vi.mock('./grid-sampler', () => ({
	centerSampleQR: vi.fn(() => null)
}));

const mockedJsQR = vi.mocked(jsQR);
const { centerSampleQR: mockedCenterSample } = await import('./grid-sampler');
const mockedCenterSampleQR = vi.mocked(mockedCenterSample);

describe('readQRFromImageData', () => {
	const imageData = {
		data: new Uint8ClampedArray(4),
		width: 1,
		height: 1
	} as ImageData;

	beforeEach(() => {
		mockedJsQR.mockReset();
		mockedCenterSampleQR.mockReset();
		mockedCenterSampleQR.mockReturnValue(null);
	});

	it('returns decoded data when jsQR finds a code', () => {
		mockedJsQR.mockReturnValue({
			data: 'https://mia.cx'
		} as ReturnType<typeof jsQR>);

		expect(readQRFromImageData(imageData)).toEqual({
			data: 'https://mia.cx',
			success: true
		});
		expect(mockedJsQR).toHaveBeenCalledTimes(1);
	});

	it('passes inversionAttempts to jsQR', () => {
		mockedJsQR.mockReturnValue({ data: 'test' } as ReturnType<typeof jsQR>);
		readQRFromImageData(imageData);
		expect(mockedJsQR).toHaveBeenCalledWith(
			expect.anything(), expect.anything(), expect.anything(),
			{ inversionAttempts: 'attemptBoth' }
		);
	});

	it('returns a friendly error when all strategies fail', () => {
		mockedJsQR.mockReturnValue(null);

		expect(readQRFromImageData(imageData)).toEqual({
			data: '',
			success: false,
			error: 'No QR code found in image'
		});
		// Called 3 times: raw, dilated, (centerSampleQR returned null so no 3rd jsQR call)
		expect(mockedJsQR).toHaveBeenCalledTimes(2);
	});

	it('falls back to dilation when raw image fails', () => {
		mockedJsQR
			.mockReturnValueOnce(null)
			.mockReturnValueOnce({ data: 'dilated-read' } as ReturnType<typeof jsQR>);

		expect(readQRFromImageData(imageData)).toEqual({
			data: 'dilated-read',
			success: true
		});
		expect(mockedJsQR).toHaveBeenCalledTimes(2);
	});

	it('falls back to center-sampling when dilation fails', () => {
		const cleanImage = { data: new Uint8ClampedArray(4), width: 1, height: 1 };
		mockedCenterSampleQR.mockReturnValue(cleanImage);
		mockedJsQR
			.mockReturnValueOnce(null) // raw fails
			.mockReturnValueOnce(null) // dilated fails
			.mockReturnValueOnce({ data: 'center-sampled' } as ReturnType<typeof jsQR>); // sampled succeeds

		expect(readQRFromImageData(imageData)).toEqual({
			data: 'center-sampled',
			success: true
		});
		expect(mockedJsQR).toHaveBeenCalledTimes(3);
		expect(mockedCenterSampleQR).toHaveBeenCalledTimes(1);
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

describe('dilateDark', () => {
	it('expands dark pixels into their light neighbors', () => {
		// 5x5 image: single dark pixel at center (2,2), rest white
		const w = 5;
		const h = 5;
		const data = new Uint8ClampedArray(w * h * 4);
		for (let i = 0; i < data.length; i += 4) {
			data[i] = 255;     // R
			data[i + 1] = 255; // G
			data[i + 2] = 255; // B
			data[i + 3] = 255; // A
		}
		// Set center pixel to black
		const center = (2 * w + 2) * 4;
		data[center] = 0;
		data[center + 1] = 0;
		data[center + 2] = 0;

		const result = dilateDark({ data, width: w, height: h } as ImageData);

		// Center pixel should still be dark
		const cIdx = (2 * w + 2) * 4;
		expect(result.data[cIdx]).toBe(0);

		// Neighbors within radius=2 should be dilated to dark
		const neighbor = (1 * w + 2) * 4; // pixel at (2,1)
		expect(result.data[neighbor]).toBe(0);

		// Corner (0,0) is exactly at distance 2√2 ≈ 2.83 from center,
		// but box kernel includes it (both axes within radius 2)
		const corner = 0;
		expect(result.data[corner]).toBe(0);
	});
});

describe('constrainImageDimensions', () => {
	it('downscales images that exceed the pixel budget while preserving aspect ratio', () => {
		expect(constrainImageDimensions(4000, 4000)).toEqual({ width: 2000, height: 2000 });
		expect(constrainImageDimensions(8000, 2000)).toEqual({ width: 4000, height: 1000 });
	});
});
