import {
	QR_OUTER_MARGIN_UNITS,
	isConnectionModeConfigurable,
	type Adj,
	type CapStyle,
	type ConnectionMode,
	type ModuleStyle,
	type QROptions
} from './qr-core';
import {
	buildAllAdjacentEdgesFromMatrix,
	buildConnectorEdgesFromMatrix,
	generateQRModules,
	getAdj,
	getAllAdjacentEdges,
	getConnectorEdges,
	getStrokeGraph,
	qrTopologyKey,
	traceStrokeGraphFromMatrix
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
	drawModuleSvg,
	shouldTraceStrokePaths,
	shouldUseFullAdjacencyConnectors
} from './qr-paths';

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

	for (let row = 0; row < count; row++) {
		for (let col = 0; col < count; col++) {
			if (!isDark(row, col)) continue;
			const x = margin + col * px;
			const y = margin + row * px;

			let adj: Adj;
			if (edges) {
				adj = {
					top: edges.has(`${row - 1},${col}-${row},${col}`),
					right: edges.has(`${row},${col}-${row},${col + 1}`),
					bottom: edges.has(`${row},${col}-${row + 1},${col}`),
					left: edges.has(`${row},${col - 1}-${row},${col}`)
				};
			} else if (useDisconnectedAdjacency) {
				adj = { top: false, right: false, bottom: false, left: false };
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
				top: edges.has(`${row - 1},${col}-${row},${col}`),
				right: edges.has(`${row},${col}-${row},${col + 1}`),
				bottom: edges.has(`${row},${col}-${row + 1},${col}`),
				left: edges.has(`${row},${col - 1}-${row},${col}`)
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
				top: edges.has(`${row - 1},${col}-${row},${col}`),
				right: edges.has(`${row},${col}-${row},${col + 1}`),
				bottom: edges.has(`${row},${col}-${row + 1},${col}`),
				left: edges.has(`${row},${col - 1}-${row},${col}`)
			};
			const s = Math.max(Math.round(px * dotSize), 1);
			const off = Math.round((px - s) / 2);
			appendCappedRectCanvasPath(ctx, x + off, y + off, s, capStyle, moduleStyle, adj);
		}
	}

	ctx.fill();
}

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

export const __test = {
	buildConnectorEdgesFromMatrix,
	buildAllAdjacentEdgesFromMatrix,
	traceStrokeGraphFromMatrix,
	isConnectionModeConfigurable
};

function escapeXml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}
