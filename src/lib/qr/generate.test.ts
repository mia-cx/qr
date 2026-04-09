import qrcode from 'qrcode-generator';
import { describe, expect, it } from 'vitest';

import { __test, generateQRSvg, type QROptions } from './generate';

const baseOptions: QROptions = {
	data: 'https://mia.cx',
	errorCorrection: 'M',
	pixelSize: 6,
	moduleStyle: 'square',
	capStyle: 'square',
	connectionMode: 'lines',
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

	it('renders disconnected reduced dot-size qr codes without connector paths', () => {
		const svg = generateQRSvg({
			...baseOptions,
			dotSize: 0.7,
			moduleStyle: 'rounded',
			connectionMode: 'disconnected'
		});

		expect(svg).not.toContain('fill="none"');
		expect(svg).not.toContain('stroke-linecap=');
	});

	it('renders disconnected rounded-corner modules as circles', () => {
		const svg = generateQRSvg({
			...baseOptions,
			moduleStyle: 'square',
			capStyle: 'circle',
			connectionMode: 'disconnected',
			dotSize: 0.7
		});

		expect(svg).toContain('<circle');
	});

	it('renders disconnected miter-corner dots as octagons instead of circles', () => {
		const svg = generateQRSvg({
			...baseOptions,
			moduleStyle: 'dots',
			capStyle: 'miter',
			connectionMode: 'disconnected',
			dotSize: 0.7
		});

		expect(svg).not.toContain('<circle');
		expect(svg).toContain('<path d="');
	});

	it('renders full-size rounded modules differently for lines and disconnected modes', () => {
		const connected = generateQRSvg({
			...baseOptions,
			moduleStyle: 'rounded',
			capStyle: 'circle',
			connectionMode: 'lines',
			dotSize: 1
		});
		const disconnected = generateQRSvg({
			...baseOptions,
			moduleStyle: 'rounded',
			capStyle: 'circle',
			connectionMode: 'disconnected',
			dotSize: 1
		});

		expect(connected).not.toEqual(disconnected);
		expect(connected.match(/<path d="/g)).toHaveLength(1);
		expect(disconnected).toContain('<circle');
	});

	it('renders full-size dot modules with connectors when lines mode is enabled', () => {
		const connected = generateQRSvg({
			...baseOptions,
			moduleStyle: 'dots',
			connectionMode: 'lines',
			dotSize: 1
		});
		const disconnected = generateQRSvg({
			...baseOptions,
			moduleStyle: 'dots',
			connectionMode: 'disconnected',
			dotSize: 1
		});

		expect(connected).toContain('<path d="');
		expect(disconnected).not.toContain('<path d="');
	});

	it('adds a 4-module quiet zone around the qr payload', () => {
		const px = 6;
		const qr = qrcode(0, baseOptions.errorCorrection);
		qr.addData(baseOptions.data);
		qr.make();
		const expectedWidth = qr.getModuleCount() * px + px * 8;
		const svg = generateQRSvg({ ...baseOptions, pixelSize: px });

		expect(svg).toContain(`viewBox="0 0 ${expectedWidth} ${expectedWidth}"`);
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

describe('full-size rounded adjacency', () => {
	it('keeps all neighboring edges when rounded modules render at 100%', () => {
		const matrix = [
			[true, true],
			[true, true]
		];
		const edges = __test.buildAllAdjacentEdgesFromMatrix(matrix);

		expect(edges.size).toBe(4);
		expect(edges).toEqual(
			new Set([edgeKey(0, 0, 0, 1), edgeKey(0, 0, 1, 0), edgeKey(0, 1, 1, 1), edgeKey(1, 0, 1, 1)])
		);
	});
});

describe('rounded stroke tracing', () => {
	it('traces a straight run as one open stroke path', () => {
		const graph = __test.traceStrokeGraphFromMatrix([
			[true, true, true],
			[false, false, false],
			[false, false, false]
		]);

		expect(graph.isolated).toEqual([]);
		expect(graph.paths).toEqual([
			{
				points: [
					{ row: 0, col: 0 },
					{ row: 0, col: 1 },
					{ row: 0, col: 2 }
				],
				closed: false
			}
		]);
	});

	it('renders rounded low-dot-size modules as stroked paths', () => {
		const svg = generateQRSvg({
			...baseOptions,
			moduleStyle: 'rounded',
			capStyle: 'circle',
			dotSize: 0.7
		});

		expect(svg).toContain('stroke-linecap="round"');
		expect(svg).toContain('stroke-linejoin="round"');
		expect(svg).toContain('fill="none"');
	});

	it('renders rounded full-size modules as filled merged shapes', () => {
		const svg = generateQRSvg({
			...baseOptions,
			moduleStyle: 'rounded',
			capStyle: 'circle',
			dotSize: 1
		});

		expect(svg).not.toContain('stroke-linecap="round"');
		expect(svg).not.toContain('fill="none"');
		expect(svg.match(/<path d="/g)).toHaveLength(1);
	});
});

describe('connection mode configurability', () => {
	it('is only irrelevant for full-size square modules with square corners', () => {
		expect(__test.isConnectionModeConfigurable('square', 'square', 1)).toBe(false);
		expect(__test.isConnectionModeConfigurable('square', 'circle', 1)).toBe(true);
		expect(__test.isConnectionModeConfigurable('rounded', 'square', 1)).toBe(true);
		expect(__test.isConnectionModeConfigurable('square', 'square', 0.5)).toBe(true);
	});
});
