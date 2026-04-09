import { describe, expect, it } from 'vitest';

import {
	binarize,
	computeGrid,
	findFinderPatterns,
	otsuThreshold,
	toGrayscale
} from './grid-sampler';

describe('toGrayscale', () => {
	it('converts RGBA to luminance', () => {
		// Pure red pixel
		const data = new Uint8ClampedArray([255, 0, 0, 255]);
		const gray = toGrayscale(data, 1, 1);
		expect(gray[0]).toBe(Math.round(255 * 0.299));
	});

	it('returns white for white pixels', () => {
		const data = new Uint8ClampedArray([255, 255, 255, 255]);
		const gray = toGrayscale(data, 1, 1);
		expect(gray[0]).toBe(255);
	});

	it('returns zero for black pixels', () => {
		const data = new Uint8ClampedArray([0, 0, 0, 255]);
		const gray = toGrayscale(data, 1, 1);
		expect(gray[0]).toBe(0);
	});
});

describe('otsuThreshold', () => {
	it('finds threshold between two clusters', () => {
		// 50 dark pixels (value 20) and 50 bright pixels (value 230)
		const gray = new Uint8Array(100);
		for (let i = 0; i < 50; i++) gray[i] = 20;
		for (let i = 50; i < 100; i++) gray[i] = 230;

		const threshold = otsuThreshold(gray);
		// Should be between the two clusters
		expect(threshold).toBeGreaterThanOrEqual(20);
		expect(threshold).toBeLessThan(230);
	});

	it('handles uniform image', () => {
		const gray = new Uint8Array(100).fill(128);
		const threshold = otsuThreshold(gray);
		expect(threshold).toBeGreaterThanOrEqual(0);
		expect(threshold).toBeLessThan(256);
	});
});

describe('binarize', () => {
	it('marks dark pixels as 1 and light as 0', () => {
		const gray = new Uint8Array([0, 50, 100, 150, 200, 255]);
		const binary = binarize(gray, 128);
		expect(Array.from(binary)).toEqual([1, 1, 1, 0, 0, 0]);
	});

	it('includes threshold value as dark', () => {
		const gray = new Uint8Array([128]);
		const binary = binarize(gray, 128);
		expect(binary[0]).toBe(1);
	});
});

describe('findFinderPatterns', () => {
	/**
	 * Build a small binary image with a finder pattern at (cx, cy).
	 * A finder pattern has the 1:1:3:1:1 ratio — we draw it as a
	 * 7-module-wide pattern centered at the given coordinates.
	 */
	function drawFinder(binary: Uint8Array, width: number, cx: number, cy: number, moduleSize: number) {
		const r = Math.floor(3.5 * moduleSize);
		for (let dy = -r; dy <= r; dy++) {
			for (let dx = -r; dx <= r; dx++) {
				const x = cx + dx;
				const y = cy + dy;
				if (x < 0 || y < 0 || x >= width) continue;
				const distX = Math.abs(dx) / moduleSize;
				const distY = Math.abs(dy) / moduleSize;
				const dist = Math.max(distX, distY);
				// Concentric squares: dark at 0-1, light at 1-2, dark at 2-3.5
				const isDark = dist <= 1 || (dist > 2 && dist <= 3.5);
				if (isDark) binary[y * width + x] = 1;
			}
		}
	}

	it('detects three finder patterns in a synthetic QR layout', () => {
		const width = 200;
		const height = 200;
		const binary = new Uint8Array(width * height);
		const mod = 6;

		// Place three finder patterns at typical QR positions
		drawFinder(binary, width, 30, 30, mod); // top-left
		drawFinder(binary, width, 170, 30, mod); // top-right
		drawFinder(binary, width, 30, 170, mod); // bottom-left

		const patterns = findFinderPatterns(binary, width, height);
		expect(patterns.length).toBeGreaterThanOrEqual(3);
	});
});

describe('computeGrid', () => {
	it('returns null with fewer than 3 patterns', () => {
		expect(computeGrid([{ cx: 10, cy: 10, moduleSize: 5 }])).toBeNull();
		expect(computeGrid([])).toBeNull();
	});

	it('identifies top-left, top-right, bottom-left from three patterns', () => {
		const patterns = [
			{ cx: 30, cy: 30, moduleSize: 5 },
			{ cx: 170, cy: 30, moduleSize: 5 },
			{ cx: 30, cy: 170, moduleSize: 5 }
		];

		const grid = computeGrid(patterns);
		expect(grid).not.toBeNull();
		expect(grid!.moduleCount).toBeGreaterThanOrEqual(21);
		expect(grid!.moduleCount % 2).toBe(1); // must be odd
		expect(grid!.moduleSize).toBeCloseTo(5, 0);
	});
});
