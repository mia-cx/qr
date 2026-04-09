import {
	type Adj,
	DISCONNECTED_ADJ,
	QR_OUTER_MARGIN_UNITS,
	edgeKey,
	generateQRModules,
	getAdj,
	getAllAdjacentEdges,
	getConnectorEdges,
	getStrokeGraph,
	qrTopologyKey
} from './qr-topology';

import {
	appendCappedRectCanvasPath,
	appendConnectorCanvasPath,
	buildSvgStrokePath,
	cappedRectPathData,
	connectorCanvas,
	connectorPathData,
	connectorSvg,
	drawCanvasStrokePath,
	drawModuleCanvas,
	drawModuleSvg
} from './qr-paths';

export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';
export type ModuleStyle = 'square' | 'rounded' | 'dots' | 'diamond';
export type CapStyle = 'square' | 'circle' | 'miter';
export type ConnectionMode = 'disconnected' | 'lines';

/** Max byte-mode capacity at version 40 per EC level (QR spec). */
export const QR_BYTE_CAPACITY: Record<ErrorCorrectionLevel, number> = {
	L: 2953,
	M: 2331,
	Q: 1663,
	H: 1273
};

export const MIN_DOT_SIZE = 1 / 2;
export const MAX_DOT_SIZE = 1;
export const MIN_PIXEL_SIZE_FOR_CUSTOM_DOTS = 3;
export const MIN_PIXEL_SIZE_FOR_DECORATIVE_CAPS = 8;
const ONE_THIRD_DOT_SIZE = 1 / 3;
const ONE_THIRD_DOT_PIXEL_SIZES = new Set([3, 6]);

export function isDotSizeConfigurable(pixelSize: number): boolean {
	return pixelSize >= MIN_PIXEL_SIZE_FOR_CUSTOM_DOTS;
}

export function isCapStyleAvailable(pixelSize: number, capStyle: CapStyle): boolean {
	return capStyle === 'square' || pixelSize >= MIN_PIXEL_SIZE_FOR_DECORATIVE_CAPS;
}

export function normalizeCapStyle(capStyle: CapStyle, pixelSize: number): CapStyle {
	return isCapStyleAvailable(pixelSize, capStyle) ? capStyle : 'square';
}

export function getPixelPerfectDotSizeStep(pixelSize: number): number {
	return pixelSize > 0 ? 1 / pixelSize : MAX_DOT_SIZE - MIN_DOT_SIZE;
}

function getDotSizeFloor(pixelSize: number): number {
	return ONE_THIRD_DOT_PIXEL_SIZES.has(pixelSize) ? ONE_THIRD_DOT_SIZE : MIN_DOT_SIZE;
}

export function getMinimumPixelPerfectDotSize(pixelSize: number): number {
	if (!isDotSizeConfigurable(pixelSize)) {
		return MAX_DOT_SIZE;
	}

	return Math.ceil(getDotSizeFloor(pixelSize) * pixelSize) / pixelSize;
}

export function normalizeDotSize(dotSize: number, pixelSize: number): number {
	if (!isDotSizeConfigurable(pixelSize)) {
		return MAX_DOT_SIZE;
	}

	const minForPixelSize = getMinimumPixelPerfectDotSize(pixelSize);
	const clamped = Math.min(Math.max(dotSize, minForPixelSize), MAX_DOT_SIZE);
	return Math.round(clamped * pixelSize) / pixelSize;
}

export function isConnectionModeConfigurable(
	moduleStyle: ModuleStyle,
	capStyle: CapStyle,
	dotSize: number
): boolean {
	return dotSize < 1 || moduleStyle !== 'square' || capStyle !== 'square';
}

export interface QROptions {
	data: string;
	errorCorrection: ErrorCorrectionLevel;
	pixelSize: number;
	moduleStyle: ModuleStyle;
	capStyle: CapStyle;
	connectionMode: ConnectionMode;
	dotSize: number; // 0.33–1.0 for 3:1 and 6:1, otherwise 0.5–1.0
	fgColor: string;
	bgColor: string;
	logo?: string;
	frameText?: string;
}

// ---------------------------------------------------------------------------
// Shared render helpers
// ---------------------------------------------------------------------------

function shouldTraceStrokePaths(
	moduleStyle: ModuleStyle,
	dotSize: number,
	connectionMode: ConnectionMode
): boolean {
	return connectionMode === 'lines' && moduleStyle === 'rounded' && dotSize < 1;
}

function shouldUseFullAdjacencyConnectors(
	moduleStyle: ModuleStyle,
	dotSize: number,
	connectionMode: ConnectionMode
): boolean {
	return (
		connectionMode === 'lines' &&
		dotSize >= 1 &&
		(moduleStyle === 'dots' || moduleStyle === 'diamond')
	);
}

function renderModules(
	cacheKey: string,
	count: number,
	isDark: (r: number, c: number) => boolean,
	px: number,
	margin: number,
	moduleStyle: ModuleStyle,
	capStyle: CapStyle,
	connectionMode: ConnectionMode,
	dotSize: number,
	drawModule: (x: number, y: number, adj: Adj) => void,
	drawConn: (x1: number, y1: number, x2: number, y2: number) => void,
	drawStrokePath: (points: { x: number; y: number }[], closed: boolean) => void
): void {
	const needsConnectors = connectionMode === 'lines' && dotSize < 1;
	const useStrokePaths = shouldTraceStrokePaths(moduleStyle, dotSize, connectionMode);
	const useFullAdjacencyConnectors = shouldUseFullAdjacencyConnectors(
		moduleStyle,
		dotSize,
		connectionMode
	);
	const useDisconnectedAdjacency =
		connectionMode === 'disconnected' &&
		isConnectionModeConfigurable(moduleStyle, capStyle, dotSize);

	if (useStrokePaths) {
		const strokeGraph = getStrokeGraph(cacheKey, count, isDark, needsConnectors);

		for (const path of strokeGraph.paths) {
			drawStrokePath(
				path.points.map(({ row, col }) => ({
					x: margin + col * px + px / 2,
					y: margin + row * px + px / 2
				})),
				path.closed
			);
		}

		for (const { row, col } of strokeGraph.isolated) {
			const x = margin + col * px;
			const y = margin + row * px;
			drawModule(x, y, { top: false, right: false, bottom: false, left: false });
		}

		return;
	}

	const edges = useFullAdjacencyConnectors
		? getAllAdjacentEdges(cacheKey, count, isDark)
		: needsConnectors
			? getConnectorEdges(cacheKey, count, isDark)
			: null;

	// Draw connectors first (behind modules)
	if (edges) {
		for (const edge of edges) {
			const [from, to] = edge.split('-');
			const [r1, c1] = from.split(',').map(Number);
			const [r2, c2] = to.split(',').map(Number);
			const x1 = margin + c1 * px;
			const y1 = margin + r1 * px;
			const x2 = margin + c2 * px;
			const y2 = margin + r2 * px;
			drawConn(x1, y1, x2, y2);
		}
	}

	// Draw modules on top — use connected adjacency when edges were built
	for (let row = 0; row < count; row++) {
		for (let col = 0; col < count; col++) {
			if (!isDark(row, col)) continue;
			const x = margin + col * px;
			const y = margin + row * px;

			let adj: Adj;
			if (edges) {
				adj = {
					top: edges.has(edgeKey(row - 1, col, row, col)),
					right: edges.has(edgeKey(row, col, row, col + 1)),
					bottom: edges.has(edgeKey(row, col, row + 1, col)),
					left: edges.has(edgeKey(row, col - 1, row, col))
				};
			} else if (useDisconnectedAdjacency) {
				adj = DISCONNECTED_ADJ;
			} else {
				adj = getAdj(row, col, count, isDark);
			}

			drawModule(x, y, adj);
		}
	}
}

function shouldBatchFilledRoundedPaths(
	moduleStyle: ModuleStyle,
	dotSize: number,
	connectionMode: ConnectionMode
): boolean {
	return connectionMode === 'lines' && moduleStyle === 'rounded' && dotSize >= 1;
}

function buildMergedFilledSvgPath(
	cacheKey: string,
	count: number,
	isDark: (r: number, c: number) => boolean,
	px: number,
	margin: number,
	moduleStyle: ModuleStyle,
	capStyle: CapStyle,
	dotSize: number
): string {
	const edges = getAllAdjacentEdges(cacheKey, count, isDark);
	let d = '';

	for (const edge of edges) {
		const [from, to] = edge.split('-');
		const [r1, c1] = from.split(',').map(Number);
		const [r2, c2] = to.split(',').map(Number);
		const x1 = margin + c1 * px;
		const y1 = margin + r1 * px;
		const x2 = margin + c2 * px;
		const y2 = margin + r2 * px;
		d += connectorPathData(x1, y1, x2, y2, px, dotSize, moduleStyle);
	}

	for (let row = 0; row < count; row++) {
		for (let col = 0; col < count; col++) {
			if (!isDark(row, col)) continue;

			const x = margin + col * px;
			const y = margin + row * px;
			const adj = {
				top: edges.has(edgeKey(row - 1, col, row, col)),
				right: edges.has(edgeKey(row, col, row, col + 1)),
				bottom: edges.has(edgeKey(row, col, row + 1, col)),
				left: edges.has(edgeKey(row, col - 1, row, col))
			};
			const s = px * dotSize;
			const off = (px - s) / 2;
			d += cappedRectPathData(x + off, y + off, s, capStyle, moduleStyle, adj);
		}
	}

	return d;
}

function drawMergedFilledCanvasPath(
	ctx: CanvasRenderingContext2D,
	cacheKey: string,
	count: number,
	isDark: (r: number, c: number) => boolean,
	px: number,
	margin: number,
	moduleStyle: ModuleStyle,
	capStyle: CapStyle,
	dotSize: number
): void {
	const edges = getAllAdjacentEdges(cacheKey, count, isDark);

	ctx.beginPath();

	for (const edge of edges) {
		const [from, to] = edge.split('-');
		const [r1, c1] = from.split(',').map(Number);
		const [r2, c2] = to.split(',').map(Number);
		const x1 = margin + c1 * px;
		const y1 = margin + r1 * px;
		const x2 = margin + c2 * px;
		const y2 = margin + r2 * px;
		appendConnectorCanvasPath(ctx, x1, y1, x2, y2, px, dotSize, moduleStyle);
	}

	for (let row = 0; row < count; row++) {
		for (let col = 0; col < count; col++) {
			if (!isDark(row, col)) continue;

			const x = margin + col * px;
			const y = margin + row * px;
			const adj = {
				top: edges.has(edgeKey(row - 1, col, row, col)),
				right: edges.has(edgeKey(row, col, row, col + 1)),
				bottom: edges.has(edgeKey(row, col, row + 1, col)),
				left: edges.has(edgeKey(row, col - 1, row, col))
			};
			const s = Math.max(Math.round(px * dotSize), 1);
			const off = Math.round((px - s) / 2);
			appendCappedRectCanvasPath(ctx, x + off, y + off, s, capStyle, moduleStyle, adj);
		}
	}

	ctx.fill();
}

// ---------------------------------------------------------------------------
// Public API — SVG
// ---------------------------------------------------------------------------

export function generateQRSvg(options: QROptions): string {
	if (!options.data) return '';

	const cacheKey = qrTopologyKey(options.data, options.errorCorrection);
	const modules = generateQRModules(options.data, options.errorCorrection);
	const count = modules.count;
	const px = options.pixelSize;
	const margin = px * QR_OUTER_MARGIN_UNITS;
	const frameHeight = options.frameText ? px * 4 : 0;
	const qrSize = count * px;
	const width = qrSize + margin * 2;
	const height = qrSize + margin * 2 + frameHeight;

	const safeFg = escapeXml(options.fgColor);
	const safeBg = escapeXml(options.bgColor);

	let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`;
	svg += `<rect width="${width}" height="${height}" fill="${safeBg}"/>`;
	svg += `<g fill="${safeFg}">`;

	if (shouldBatchFilledRoundedPaths(options.moduleStyle, options.dotSize, options.connectionMode)) {
		svg += `<path d="${buildMergedFilledSvgPath(
			cacheKey,
			count,
			modules.isDark,
			px,
			margin,
			options.moduleStyle,
			options.capStyle,
			options.dotSize
		)}"/>`;
	} else {
		renderModules(
			cacheKey,
			count,
			modules.isDark,
			px,
			margin,
			options.moduleStyle,
			options.capStyle,
			options.connectionMode,
			options.dotSize,
			(x, y, adj) => {
				svg += drawModuleSvg(x, y, px, options.moduleStyle, options.capStyle, options.dotSize, adj);
			},
			(x1, y1, x2, y2) => {
				svg += connectorSvg(x1, y1, x2, y2, px, options.dotSize, options.moduleStyle);
			},
			(points, closed) => {
				svg += buildSvgStrokePath(points, closed, px, options.dotSize, options.capStyle, safeFg);
			}
		);
	}

	svg += '</g>';

	if (options.logo) {
		const safeLogo = escapeXml(options.logo);
		const logoSize = qrSize * 0.25;
		const logoX = margin + (qrSize - logoSize) / 2;
		const logoY = margin + (qrSize - logoSize) / 2;
		const logoPad = px;
		svg += `<rect x="${logoX - logoPad}" y="${logoY - logoPad}" width="${logoSize + logoPad * 2}" height="${logoSize + logoPad * 2}" fill="${safeBg}" rx="${px}"/>`;
		svg += `<image x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}" href="${safeLogo}" preserveAspectRatio="xMidYMid meet"/>`;
	}

	if (options.frameText) {
		const textY = margin + qrSize + frameHeight * 0.7;
		svg += `<text x="${width / 2}" y="${textY}" text-anchor="middle" font-family="sans-serif" font-size="${px * 2.5}" font-weight="bold" fill="${safeFg}">${escapeXml(options.frameText)}</text>`;
	}

	svg += '</svg>';
	return svg;
}

// ---------------------------------------------------------------------------
// Public API — Canvas
// ---------------------------------------------------------------------------

export async function generateQRCanvas(
	canvas: HTMLCanvasElement,
	options: QROptions
): Promise<void> {
	if (!options.data) return;

	const cacheKey = qrTopologyKey(options.data, options.errorCorrection);
	const modules = generateQRModules(options.data, options.errorCorrection);
	const count = modules.count;
	const px = options.pixelSize;
	const margin = px * QR_OUTER_MARGIN_UNITS;
	const frameHeight = options.frameText ? px * 4 : 0;
	const qrSize = count * px;
	const width = qrSize + margin * 2;
	const height = qrSize + margin * 2 + frameHeight;

	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d', { colorSpace: 'srgb' })!;
	ctx.imageSmoothingEnabled = false;

	ctx.fillStyle = options.bgColor;
	ctx.fillRect(0, 0, width, height);
	ctx.fillStyle = options.fgColor;

	if (shouldBatchFilledRoundedPaths(options.moduleStyle, options.dotSize, options.connectionMode)) {
		drawMergedFilledCanvasPath(
			ctx,
			cacheKey,
			count,
			modules.isDark,
			px,
			margin,
			options.moduleStyle,
			options.capStyle,
			options.dotSize
		);
	} else {
		renderModules(
			cacheKey,
			count,
			modules.isDark,
			px,
			margin,
			options.moduleStyle,
			options.capStyle,
			options.connectionMode,
			options.dotSize,
			(x, y, adj) => {
				drawModuleCanvas(
					ctx,
					x,
					y,
					px,
					options.moduleStyle,
					options.capStyle,
					options.dotSize,
					adj
				);
			},
			(x1, y1, x2, y2) => {
				connectorCanvas(ctx, x1, y1, x2, y2, px, options.dotSize, options.moduleStyle);
			},
			(points, closed) => {
				drawCanvasStrokePath(ctx, points, closed, px, options.dotSize, options.capStyle);
			}
		);
	}

	if (options.logo) {
		const logoSize = qrSize * 0.25;
		const logoX = margin + (qrSize - logoSize) / 2;
		const logoY = margin + (qrSize - logoSize) / 2;
		const logoPad = px;

		ctx.fillStyle = options.bgColor;
		ctx.beginPath();
		ctx.roundRect(
			logoX - logoPad,
			logoY - logoPad,
			logoSize + logoPad * 2,
			logoSize + logoPad * 2,
			px
		);
		ctx.fill();

		const img = new Image();
		img.src = options.logo;
		await new Promise<void>((resolve, reject) => {
			img.onload = () => resolve();
			img.onerror = () => reject(new Error('Failed to load logo'));
		});
		ctx.drawImage(img, logoX, logoY, logoSize, logoSize);
	}

	if (options.frameText) {
		ctx.fillStyle = options.fgColor;
		ctx.font = `bold ${px * 2.5}px sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(options.frameText, width / 2, margin + qrSize + frameHeight * 0.5);
	}
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function escapeXml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}
