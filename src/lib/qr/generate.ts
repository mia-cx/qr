import qrcode from 'qrcode-generator';

export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';
export type ModuleStyle = 'square' | 'rounded' | 'dots' | 'diamond';
export type CapStyle = 'square' | 'circle' | 'miter';

export interface QROptions {
	data: string;
	errorCorrection: ErrorCorrectionLevel;
	pixelSize: number;
	moduleStyle: ModuleStyle;
	capStyle: CapStyle;
	dotSize: number; // 0.3–1.0, fraction of cell size
	fgColor: string;
	bgColor: string;
	logo?: string;
	frameText?: string;
}

interface QRModules {
	count: number;
	isDark: (row: number, col: number) => boolean;
}

interface Adj {
	top: boolean;
	right: boolean;
	bottom: boolean;
	left: boolean;
}

// ---------------------------------------------------------------------------
// QR data
// ---------------------------------------------------------------------------

function generateQRModules(data: string, errorCorrection: ErrorCorrectionLevel): QRModules {
	const qr = qrcode(0, errorCorrection);
	qr.addData(data);
	qr.make();
	return {
		count: qr.getModuleCount(),
		isDark: (row: number, col: number) => qr.isDark(row, col)
	};
}

// ---------------------------------------------------------------------------
// Adjacency helpers
// ---------------------------------------------------------------------------

function getAdj(
	row: number,
	col: number,
	count: number,
	isDark: (r: number, c: number) => boolean
): Adj {
	return {
		top: row > 0 && isDark(row - 1, col),
		right: col < count - 1 && isDark(row, col + 1),
		bottom: row < count - 1 && isDark(row + 1, col),
		left: col > 0 && isDark(row, col - 1)
	};
}

type Edge = `${number},${number}-${number},${number}`;
type EdgeDirection = 'horizontal' | 'vertical';

interface EdgeCandidate {
	key: Edge;
	row: number;
	col: number;
	direction: EdgeDirection;
}

const ROUNDED_MODULE_RADIUS = 10;

function edgeKey(r1: number, c1: number, r2: number, c2: number): Edge {
	return `${r1},${c1}-${r2},${c2}`;
}

/** Deterministic pick seeded by grid position. */
function posHash(row: number, col: number): number {
	let h = row * 7919 + col * 104729;
	h = ((h >>> 16) ^ h) * 0x45d9f3b;
	return ((h >>> 16) ^ h) >>> 0;
}

/**
 * Give edges a deterministic but non-grid-like order so we get a little
 * variation without ever needing an unbounded retry loop.
 */
function edgePriority(candidate: EdgeCandidate): number {
	const endRow = candidate.direction === 'horizontal' ? candidate.row : candidate.row + 1;
	const endCol = candidate.direction === 'horizontal' ? candidate.col + 1 : candidate.col;
	const start = posHash(candidate.row, candidate.col);
	const end = posHash(endRow, endCol);
	const directionSalt = candidate.direction === 'horizontal' ? 0x9e3779b1 : 0x85ebca6b;

	return (start ^ ((end << 1) | (end >>> 31)) ^ directionSalt) >>> 0;
}

function getLoopEdges(row: number, col: number): [Edge, Edge, Edge, Edge] {
	return [
		edgeKey(row, col, row, col + 1),
		edgeKey(row, col + 1, row + 1, col + 1),
		edgeKey(row + 1, col, row + 1, col + 1),
		edgeKey(row, col, row + 1, col)
	];
}

function isSolidTwoByTwo(
	row: number,
	col: number,
	count: number,
	isDark: (r: number, c: number) => boolean
): boolean {
	return (
		row >= 0 &&
		row < count - 1 &&
		col >= 0 &&
		col < count - 1 &&
		isDark(row, col) &&
		isDark(row, col + 1) &&
		isDark(row + 1, col) &&
		isDark(row + 1, col + 1)
	);
}

function wouldCloseTwoByTwo(
	candidate: EdgeCandidate,
	edges: ReadonlySet<Edge>,
	count: number,
	isDark: (r: number, c: number) => boolean
): boolean {
	const possibleLoops =
		candidate.direction === 'horizontal'
			? [
					[candidate.row, candidate.col],
					[candidate.row - 1, candidate.col]
				]
			: [
					[candidate.row, candidate.col],
					[candidate.row, candidate.col - 1]
				];

	for (const [row, col] of possibleLoops) {
		if (!isSolidTwoByTwo(row, col, count, isDark)) {
			continue;
		}

		const otherEdges = getLoopEdges(row, col).filter((edge) => edge !== candidate.key);
		if (otherEdges.every((edge) => edges.has(edge))) {
			return true;
		}
	}

	return false;
}

/**
 * Build connector edges between adjacent dark modules while skipping any edge
 * that would create a fully closed 2x2 loop.
 */
function buildConnectorEdges(count: number, isDark: (r: number, c: number) => boolean): Set<Edge> {
	const candidates: EdgeCandidate[] = [];

	for (let row = 0; row < count; row++) {
		for (let col = 0; col < count; col++) {
			if (!isDark(row, col)) continue;
			if (col < count - 1 && isDark(row, col + 1)) {
				candidates.push({
					key: edgeKey(row, col, row, col + 1),
					row,
					col,
					direction: 'horizontal'
				});
			}
			if (row < count - 1 && isDark(row + 1, col)) {
				candidates.push({
					key: edgeKey(row, col, row + 1, col),
					row,
					col,
					direction: 'vertical'
				});
			}
		}
	}

	candidates.sort((a, b) => {
		const priorityDiff = edgePriority(a) - edgePriority(b);
		if (priorityDiff !== 0) {
			return priorityDiff;
		}

		return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
	});

	const edges = new Set<Edge>();

	for (const candidate of candidates) {
		if (!wouldCloseTwoByTwo(candidate, edges, count, isDark)) {
			edges.add(candidate.key);
		}
	}

	return edges;
}

export const __test = {
	buildConnectorEdgesFromMatrix(matrix: boolean[][]): Set<Edge> {
		return buildConnectorEdges(matrix.length, (row, col) => matrix[row]?.[col] ?? false);
	}
};

/**
 * Which corners are "exposed" — no dark neighbour on either adjacent side.
 * Returns [TL, TR, BR, BL].
 */
function exposedCorners(adj: Adj): [boolean, boolean, boolean, boolean] {
	return [
		!adj.top && !adj.left,
		!adj.top && !adj.right,
		!adj.bottom && !adj.right,
		!adj.bottom && !adj.left
	];
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
	const exp = exposedCorners(adj);
	const baseR = moduleStyle === 'rounded' ? s * ROUNDED_MODULE_RADIUS : 0;

	if (capStyle === 'square') {
		return baseR > 0
			? `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${baseR}"/>`
			: `<rect x="${x}" y="${y}" width="${s}" height="${s}"/>`;
	}

	if (capStyle === 'circle') {
		const capR = s / 2;
		const radii = exp.map((e) => (e ? capR : baseR)) as [number, number, number, number];
		if (radii.every((r) => r === radii[0])) {
			return `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${radii[0]}"/>`;
		}
		return `<path d="${roundedRectPath(x, y, s, s, radii)}"/>`;
	}

	// miter
	const cut = s * 0.35;
	const cuts = exp.map((e) => (e ? cut : 0)) as [number, number, number, number];
	if (cuts.every((c) => c === 0)) {
		return baseR > 0
			? `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${baseR}"/>`
			: `<rect x="${x}" y="${y}" width="${s}" height="${s}"/>`;
	}
	return `<path d="${miteredRectPath(x, y, s, s, cuts)}"/>`;
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
	const s = px * dotSize;
	const thickness = moduleStyle === 'dots' ? s * 0.9 : s;
	const isHoriz = y1 === y2;

	if (isHoriz) {
		const cy = y1 + px / 2;
		const left = Math.min(x1, x2) + px / 2;
		return `<rect x="${left}" y="${cy - thickness / 2}" width="${px}" height="${thickness}"/>`;
	}
	const cx = x1 + px / 2;
	const top = Math.min(y1, y2) + px / 2;
	return `<rect x="${cx - thickness / 2}" y="${top}" width="${thickness}" height="${px}"/>`;
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
	const exp = exposedCorners(adj);
	const baseR = moduleStyle === 'rounded' ? Math.round(s * ROUNDED_MODULE_RADIUS) : 0;

	if (capStyle === 'square') {
		ctx.beginPath();
		if (baseR > 0) ctx.roundRect(x, y, s, s, baseR);
		else ctx.rect(x, y, s, s);
		ctx.fill();
		return;
	}

	if (capStyle === 'circle') {
		const capR = Math.floor(s / 2);
		ctx.beginPath();
		ctx.roundRect(
			x,
			y,
			s,
			s,
			exp.map((e) => (e ? capR : baseR))
		);
		ctx.fill();
		return;
	}

	// miter
	const cut = Math.round(s * 0.35);
	const cuts = exp.map((e) => (e ? cut : 0)) as [number, number, number, number];
	if (cuts.every((c) => c === 0)) {
		ctx.beginPath();
		if (baseR > 0) ctx.roundRect(x, y, s, s, baseR);
		else ctx.rect(x, y, s, s);
		ctx.fill();
		return;
	}
	const [tl, tr, br, bl] = cuts;
	ctx.beginPath();
	ctx.moveTo(x + tl, y);
	ctx.lineTo(x + s - tr, y);
	ctx.lineTo(x + s, y + tr);
	ctx.lineTo(x + s, y + s - br);
	ctx.lineTo(x + s - br, y + s);
	ctx.lineTo(x + bl, y + s);
	ctx.lineTo(x, y + s - bl);
	ctx.lineTo(x, y + tl);
	ctx.closePath();
	ctx.fill();
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

// ---------------------------------------------------------------------------
// Shared render helpers
// ---------------------------------------------------------------------------

function renderModules(
	count: number,
	isDark: (r: number, c: number) => boolean,
	px: number,
	margin: number,
	moduleStyle: ModuleStyle,
	capStyle: CapStyle,
	dotSize: number,
	drawModule: (x: number, y: number, adj: Adj) => void,
	drawConn: (x1: number, y1: number, x2: number, y2: number) => void
): void {
	const needsConnectors = dotSize < 1;

	const edges = needsConnectors ? buildConnectorEdges(count, isDark) : null;

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
			} else {
				adj = getAdj(row, col, count, isDark);
			}

			drawModule(x, y, adj);
		}
	}
}

// ---------------------------------------------------------------------------
// Public API — SVG
// ---------------------------------------------------------------------------

export function generateQRSvg(options: QROptions): string {
	if (!options.data) return '';

	const modules = generateQRModules(options.data, options.errorCorrection);
	const count = modules.count;
	const px = options.pixelSize;
	const margin = px * 2;
	const frameHeight = options.frameText ? px * 4 : 0;
	const qrSize = count * px;
	const width = qrSize + margin * 2;
	const height = qrSize + margin * 2 + frameHeight;

	const safeFg = escapeXml(options.fgColor);
	const safeBg = escapeXml(options.bgColor);

	let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`;
	svg += `<rect width="${width}" height="${height}" fill="${safeBg}"/>`;
	svg += `<g fill="${safeFg}">`;

	renderModules(
		count,
		modules.isDark,
		px,
		margin,
		options.moduleStyle,
		options.capStyle,
		options.dotSize,
		(x, y, adj) => {
			svg += drawModuleSvg(x, y, px, options.moduleStyle, options.capStyle, options.dotSize, adj);
		},
		(x1, y1, x2, y2) => {
			svg += connectorSvg(x1, y1, x2, y2, px, options.dotSize, options.moduleStyle);
		}
	);

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

	const modules = generateQRModules(options.data, options.errorCorrection);
	const count = modules.count;
	const px = options.pixelSize;
	const margin = px * 2;
	const frameHeight = options.frameText ? px * 4 : 0;
	const qrSize = count * px;
	const width = qrSize + margin * 2;
	const height = qrSize + margin * 2 + frameHeight;

	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d')!;

	ctx.fillStyle = options.bgColor;
	ctx.fillRect(0, 0, width, height);
	ctx.fillStyle = options.fgColor;

	renderModules(
		count,
		modules.isDark,
		px,
		margin,
		options.moduleStyle,
		options.capStyle,
		options.dotSize,
		(x, y, adj) => {
			drawModuleCanvas(ctx, x, y, px, options.moduleStyle, options.capStyle, options.dotSize, adj);
		},
		(x1, y1, x2, y2) => {
			connectorCanvas(ctx, x1, y1, x2, y2, px, options.dotSize, options.moduleStyle);
		}
	);

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
