import { describe, expect, it } from 'vitest';

import { __test, generateQRSvg, type QROptions } from './generate';

const baseOptions: QROptions = {
	data: 'https://mia.cx',
	errorCorrection: 'M',
	pixelSize: 6,
	moduleStyle: 'square',
	capStyle: 'square',
	dotSize: 1,
	fgColor: '#111111',
	bgColor: '#fafafa',
	frameText: ''
};

function edgeKey(r1: number, c1: number, r2: number, c2: number) {
	return `${r1},${c1}-${r2},${c2}`;
}

function expectNoClosedTwoByTwoLoops(matrix: boolean[][], edges: ReadonlySet<string>) {
	for (let row = 0; row < matrix.length - 1; row++) {
		for (let col = 0; col < matrix[row].length - 1; col++) {
			if (
				!matrix[row][col] ||
				!matrix[row][col + 1] ||
				!matrix[row + 1][col] ||
				!matrix[row + 1][col + 1]
			) {
				continue;
			}

			const loopEdges = [
				edgeKey(row, col, row, col + 1),
				edgeKey(row, col + 1, row + 1, col + 1),
				edgeKey(row + 1, col, row + 1, col + 1),
				edgeKey(row, col, row + 1, col)
			];

			expect(loopEdges.every((edge) => edges.has(edge))).toBe(false);
		}
	}
}

describe('generateQRSvg', () => {
	it('returns an empty string when there is no QR payload', () => {
		expect(generateQRSvg({ ...baseOptions, data: '' })).toBe('');
	});

	it('renders svg markup with the configured colors and escaped frame text', () => {
		const svg = generateQRSvg({
			...baseOptions,
			frameText: 'mia <qr> & friends'
		});

		expect(svg).toContain('<svg');
		expect(svg).toContain('fill="#fafafa"');
		expect(svg).toContain('fill="#111111"');
		expect(svg).toContain('mia &lt;qr&gt; &amp; friends');
	});

	it.each(['L', 'M', 'Q', 'H'] as const)(
		'accepts %s error correction without throwing',
		(errorCorrection) => {
			expect(
				generateQRSvg({
					...baseOptions,
					errorCorrection
				})
			).toContain('<svg');
		}
	);

	it('renders reduced dot-size qr codes without hanging', () => {
		expect(
			generateQRSvg({
				...baseOptions,
				dotSize: 0.7,
				moduleStyle: 'rounded',
				capStyle: 'circle'
			})
		).toContain('<svg');
	});
});

describe('connector loop prevention', () => {
	it('breaks a solid 2x2 block by removing one connector edge', () => {
		const matrix = [
			[true, true],
			[true, true]
		];
		const edges = __test.buildConnectorEdgesFromMatrix(matrix);

		expect(edges.size).toBe(3);
		expectNoClosedTwoByTwoLoops(matrix, edges);
	});

	it('keeps dense clusters free of closed 2x2 connector loops', () => {
		const matrix = [
			[true, true, true],
			[true, true, true],
			[true, true, true]
		];
		const edges = __test.buildConnectorEdgesFromMatrix(matrix);

		expectNoClosedTwoByTwoLoops(matrix, edges);
		expect(edges.size).toBeGreaterThan(0);
	});
});
