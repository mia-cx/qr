import {
	type Adj,
	DISCONNECTED_ADJ,
	QR_OUTER_MARGIN_UNITS,
	ROUNDED_MODULE_RADIUS,
	edgeKey,
	exposedCorners,
	generateQRModules,
	getAdj,
	getAllAdjacentEdges,
	getConnectorEdges,
	getStrokeGraph,
	qrTopologyKey,
	__test
} from './qr-topology';

export { __test };

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
// SVG path helpers
// ---------------------------------------------------------------------------

function roundedRectPath(
	x: number,
	y: number,
	w: number,
	h: number,
	r: [number, number, number, number]
): string {
	const [tl, tr, br, bl] = r;
	let d = `M${x + tl},${y}`;
	d += `H${x + w - tr}`;
	d += tr ? `A${tr},${tr} 0 0 1 ${x + w},${y + tr}` : `L${x + w},${y}`;
	d += `V${y + h - br}`;
	d += br ? `A${br},${br} 0 0 1 ${x + w - br},${y + h}` : `L${x + w},${y + h}`;
	d += `H${x + bl}`;
	d += bl ? `A${bl},${bl} 0 0 1 ${x},${y + h - bl}` : `L${x},${y + h}`;
	d += `V${y + tl}`;
	d += tl ? `A${tl},${tl} 0 0 1 ${x + tl},${y}` : `L${x},${y}`;
	return d + 'Z';
}

function miteredRectPath(
	x: number,
	y: number,
	w: number,
	h: number,
	c: [number, number, number, number]
): string {
	const [tl, tr, br, bl] = c;
	return (
		`M${x + tl},${y}` +
		`L${x + w - tr},${y}L${x + w},${y + tr}` +
		`L${x + w},${y + h - br}L${x + w - br},${y + h}` +
		`L${x + bl},${y + h}L${x},${y + h - bl}` +
		`L${x},${y + tl}Z`
	);
}

function rectPath(x: number, y: number, w: number, h: number): string {
	return `M${x},${y}H${x + w}V${y + h}H${x}Z`;
}

function octagonPath(x: number, y: number, s: number): string {
	const cut = s * 0.35;
	return miteredRectPath(x, y, s, s, [cut, cut, cut, cut]);
}

function isStandaloneModule(adj: Adj): boolean {
	return !adj.top && !adj.right && !adj.bottom && !adj.left;
}

function cappedRectPathData(
	x: number,
	y: number,
	s: number,
	capStyle: CapStyle,
	moduleStyle: ModuleStyle,
	adj: Adj
): string {
	const exp = exposedCorners(adj);
	const baseR = moduleStyle === 'rounded' ? s * ROUNDED_MODULE_RADIUS : 0;

	if (capStyle === 'square') {
		return baseR > 0
			? roundedRectPath(x, y, s, s, [baseR, baseR, baseR, baseR])
			: rectPath(x, y, s, s);
	}

	if (capStyle === 'circle') {
		const capR = s / 2;
		const radii = exp.map((e) => (e ? capR : baseR)) as [number, number, number, number];
		return roundedRectPath(x, y, s, s, radii);
	}

	const cut = s * 0.35;
	const cuts = exp.map((e) => (e ? cut : 0)) as [number, number, number, number];
	return cuts.every((value) => value === 0)
		? baseR > 0
			? roundedRectPath(x, y, s, s, [baseR, baseR, baseR, baseR])
			: rectPath(x, y, s, s)
		: miteredRectPath(x, y, s, s, cuts);
}

function connectorPathData(
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	px: number,
	dotSize: number,
	moduleStyle: ModuleStyle
): string {
	const s = px * dotSize;
	const thickness = moduleStyle === 'dots' ? s * 0.9 : s;
	const isHoriz = y1 === y2;

	if (isHoriz) {
		const cy = y1 + px / 2;
		const left = Math.min(x1, x2) + px / 2;
		return rectPath(left, cy - thickness / 2, px, thickness);
	}

	const cx = x1 + px / 2;
	const top = Math.min(y1, y2) + px / 2;
	return rectPath(cx - thickness / 2, top, thickness, px);
}

function appendCappedRectCanvasPath(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	s: number,
	capStyle: CapStyle,
	moduleStyle: ModuleStyle,
	adj: Adj
): void {
	const exp = exposedCorners(adj);
	const baseR = moduleStyle === 'rounded' ? Math.round(s * ROUNDED_MODULE_RADIUS) : 0;

	if (capStyle === 'square') {
		if (baseR > 0) ctx.roundRect(x, y, s, s, baseR);
		else ctx.rect(x, y, s, s);
		return;
	}

	if (capStyle === 'circle') {
		const capR = Math.floor(s / 2);
		ctx.roundRect(
			x,
			y,
			s,
			s,
			exp.map((e) => (e ? capR : baseR))
		);
		return;
	}

	const cut = Math.round(s * 0.35);
	const cuts = exp.map((e) => (e ? cut : 0)) as [number, number, number, number];
	if (cuts.every((value) => value === 0)) {
		if (baseR > 0) ctx.roundRect(x, y, s, s, baseR);
		else ctx.rect(x, y, s, s);
		return;
	}

	const [tl, tr, br, bl] = cuts;
	ctx.moveTo(x + tl, y);
	ctx.lineTo(x + s - tr, y);
	ctx.lineTo(x + s, y + tr);
	ctx.lineTo(x + s, y + s - br);
	ctx.lineTo(x + s - br, y + s);
	ctx.lineTo(x + bl, y + s);
	ctx.lineTo(x, y + s - bl);
	ctx.lineTo(x, y + tl);
	ctx.closePath();
}

function appendConnectorCanvasPath(
	ctx: CanvasRenderingContext2D,
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	px: number,
	dotSize: number,
	moduleStyle: ModuleStyle
): void {
	const s = px * dotSize;
	const thickness = moduleStyle === 'dots' ? s * 0.9 : s;
	const isHoriz = y1 === y2;

	if (isHoriz) {
		const cy = y1 + px / 2;
		const left = Math.min(x1, x2) + px / 2;
		ctx.rect(left, cy - thickness / 2, px, thickness);
		return;
	}

	const cx = x1 + px / 2;
	const top = Math.min(y1, y2) + px / 2;
	ctx.rect(cx - thickness / 2, top, thickness, px);
}

// ---------------------------------------------------------------------------
// Module drawing — SVG
// ---------------------------------------------------------------------------

function cappedRectSvg(
	x: number,
	y: number,
	s: number,
	capStyle: CapStyle,
	moduleStyle: ModuleStyle,
	adj: Adj
): string {
	return `<path d="${cappedRectPathData(x, y, s, capStyle, moduleStyle, adj)}"/>`;
}

function drawStandaloneModuleSvg(
	x: number,
	y: number,
	s: number,
	capStyle: CapStyle,
	moduleStyle: ModuleStyle
): string | null {
	if (capStyle === 'circle') {
		const radius = moduleStyle === 'dots' ? s * 0.45 : s / 2;
		return `<circle cx="${x + s / 2}" cy="${y + s / 2}" r="${radius}"/>`;
	}

	if (capStyle === 'miter') {
		return `<path d="${octagonPath(x, y, s)}"/>`;
	}

	return null;
}

function drawModuleSvg(
	x: number,
	y: number,
	px: number,
	moduleStyle: ModuleStyle,
	capStyle: CapStyle,
	dotSize: number,
	adj: Adj
): string {
	const s = px * dotSize;
	const off = (px - s) / 2;
	const mx = x + off;
	const my = y + off;

	if (isStandaloneModule(adj)) {
		const standaloneShape = drawStandaloneModuleSvg(mx, my, s, capStyle, moduleStyle);
		if (standaloneShape) return standaloneShape;
	}

	switch (moduleStyle) {
		case 'square':
		case 'rounded':
			return cappedRectSvg(mx, my, s, capStyle, moduleStyle, adj);
		case 'dots': {
			const cx = x + px / 2;
			const cy = y + px / 2;
			return `<circle cx="${cx}" cy="${cy}" r="${s * 0.45}"/>`;
		}
		case 'diamond': {
			const cx = x + px / 2;
			const cy = y + px / 2;
			const h = s * 0.5;
			return `<polygon points="${cx},${cy - h} ${cx + h},${cy} ${cx},${cy + h} ${cx - h},${cy}"/>`;
		}
	}
}

function connectorSvg(
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	px: number,
	dotSize: number,
	moduleStyle: ModuleStyle
): string {
	return `<path d="${connectorPathData(x1, y1, x2, y2, px, dotSize, moduleStyle)}"/>`;
}

// ---------------------------------------------------------------------------
// Module drawing — Canvas
// ---------------------------------------------------------------------------

function cappedRectCanvas(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	s: number,
	capStyle: CapStyle,
	moduleStyle: ModuleStyle,
	adj: Adj
): void {
	ctx.beginPath();
	appendCappedRectCanvasPath(ctx, x, y, s, capStyle, moduleStyle, adj);
	ctx.fill();
}

function drawStandaloneModuleCanvas(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	s: number,
	capStyle: CapStyle,
	moduleStyle: ModuleStyle
): boolean {
	if (capStyle === 'circle') {
		const radius = moduleStyle === 'dots' ? Math.max(Math.round(s * 0.45), 1) : s / 2;
		ctx.beginPath();
		ctx.arc(x + s / 2, y + s / 2, radius, 0, Math.PI * 2);
		ctx.fill();
		return true;
	}

	if (capStyle === 'miter') {
		ctx.beginPath();
		appendCappedRectCanvasPath(ctx, x, y, s, 'miter', 'square', DISCONNECTED_ADJ);
		ctx.fill();
		return true;
	}

	return false;
}

function drawModuleCanvas(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	px: number,
	moduleStyle: ModuleStyle,
	capStyle: CapStyle,
	dotSize: number,
	adj: Adj
): void {
	// Snap to pixel grid to avoid sub-pixel anti-aliasing at low ratios
	const s = Math.max(Math.round(px * dotSize), 1);
	const off = Math.round((px - s) / 2);
	const mx = x + off;
	const my = y + off;

	// Too small for shape detail — just fill the pixel(s)
	if (s <= 2) {
		ctx.fillRect(mx, my, s, s);
		return;
	}

	if (
		isStandaloneModule(adj) &&
		drawStandaloneModuleCanvas(ctx, mx, my, s, capStyle, moduleStyle)
	) {
		return;
	}

	switch (moduleStyle) {
		case 'square':
		case 'rounded':
			cappedRectCanvas(ctx, mx, my, s, capStyle, moduleStyle, adj);
			return;
		case 'dots': {
			const cx = x + Math.round(px / 2);
			const cy = y + Math.round(px / 2);
			const r = Math.max(Math.round(s * 0.45), 1);
			ctx.beginPath();
			ctx.arc(cx, cy, r, 0, Math.PI * 2);
			ctx.fill();
			return;
		}
		case 'diamond': {
			const cx = x + Math.round(px / 2);
			const cy = y + Math.round(px / 2);
			const h = Math.round(s * 0.5);
			ctx.beginPath();
			ctx.moveTo(cx, cy - h);
			ctx.lineTo(cx + h, cy);
			ctx.lineTo(cx, cy + h);
			ctx.lineTo(cx - h, cy);
			ctx.closePath();
			ctx.fill();
			return;
		}
	}
}

function connectorCanvas(
	ctx: CanvasRenderingContext2D,
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	px: number,
	dotSize: number,
	moduleStyle: ModuleStyle
): void {
	const s = Math.max(Math.round(px * dotSize), 1);
	const thickness = moduleStyle === 'dots' ? Math.max(Math.round(s * 0.9), 1) : s;
	const isHoriz = y1 === y2;

	if (isHoriz) {
		const cy = Math.round(y1 + px / 2 - thickness / 2);
		const left = Math.round(Math.min(x1, x2) + px / 2);
		ctx.fillRect(left, cy, px, thickness);
	} else {
		const cx = Math.round(x1 + px / 2 - thickness / 2);
		const top = Math.round(Math.min(y1, y2) + px / 2);
		ctx.fillRect(cx, top, thickness, px);
	}
}

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

function getStrokeLineCap(capStyle: CapStyle): CanvasLineCap {
	return capStyle === 'circle' ? 'round' : 'square';
}

function getStrokeLineJoin(capStyle: CapStyle): CanvasLineJoin {
	return capStyle === 'circle' ? 'round' : 'miter';
}

function buildSvgStrokePath(
	points: { x: number; y: number }[],
	closed: boolean,
	px: number,
	dotSize: number,
	capStyle: CapStyle,
	color: string
): string {
	if (points.length < 2) return '';

	const d = points
		.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`)
		.join(' ');
	return `<path d="${closed ? `${d} Z` : d}" fill="none" stroke="${color}" stroke-width="${px * dotSize}" stroke-linecap="${getStrokeLineCap(capStyle)}" stroke-linejoin="${getStrokeLineJoin(capStyle)}"/>`;
}

function drawCanvasStrokePath(
	ctx: CanvasRenderingContext2D,
	points: { x: number; y: number }[],
	closed: boolean,
	px: number,
	dotSize: number,
	capStyle: CapStyle
): void {
	if (points.length < 2) return;

	ctx.save();
	ctx.beginPath();
	ctx.lineWidth = Math.max(px * dotSize, 1);
	ctx.lineCap = getStrokeLineCap(capStyle);
	ctx.lineJoin = getStrokeLineJoin(capStyle);
	ctx.moveTo(points[0].x, points[0].y);

	for (let index = 1; index < points.length; index++) {
		ctx.lineTo(points[index].x, points[index].y);
	}

	if (closed) ctx.closePath();
	ctx.stroke();
	ctx.restore();
}

// ---------------------------------------------------------------------------
// Shared render helpers
// ---------------------------------------------------------------------------

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
