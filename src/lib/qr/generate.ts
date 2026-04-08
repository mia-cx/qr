import qrcode from 'qrcode-generator';

export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';
export type ModuleStyle = 'square' | 'rounded' | 'dots' | 'diamond';
export type CapStyle = 'square' | 'circle' | 'miter';
export type ConnectionMode = 'disconnected' | 'lines';

export const MIN_DOT_SIZE = 1 / 2;
export const MAX_DOT_SIZE = 1;
export const MIN_PIXEL_SIZE_FOR_CUSTOM_DOTS = 3;
export const MIN_PIXEL_SIZE_FOR_DECORATIVE_CAPS = 8;
const QR_OUTER_MARGIN_UNITS = 4;
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

function createQRModules(data: string, errorCorrection: ErrorCorrectionLevel): QRModules {
	const qr = qrcode(0, errorCorrection);
	qr.addData(data);
	qr.make();
	return {
		count: qr.getModuleCount(),
		isDark: (row: number, col: number) => qr.isDark(row, col)
	};
}

function generateQRModules(data: string, errorCorrection: ErrorCorrectionLevel): QRModules {
	const key = qrTopologyKey(data, errorCorrection);
	if (modulesCache?.key === key) {
		return modulesCache.value;
	}

	const modules = createQRModules(data, errorCorrection);
	modulesCache = { key, value: modules };
	return modules;
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

type NodeKey = `${number},${number}`;

interface GridPoint {
	row: number;
	col: number;
}

interface StrokePath {
	points: GridPoint[];
	closed: boolean;
}

interface StrokeGraph {
	paths: StrokePath[];
	isolated: GridPoint[];
}

interface SingleEntryCache<T> {
	key: string;
	value: T;
}

const ROUNDED_MODULE_RADIUS = 10;
let modulesCache: SingleEntryCache<QRModules> | null = null;
let connectorEdgesCache: SingleEntryCache<Set<Edge>> | null = null;
let allAdjacentEdgesCache: SingleEntryCache<Set<Edge>> | null = null;
let strokeGraphCache: SingleEntryCache<StrokeGraph> | null = null;

function qrTopologyKey(data: string, errorCorrection: ErrorCorrectionLevel): string {
	return `${errorCorrection}\u0000${data}`;
}

function edgeKey(r1: number, c1: number, r2: number, c2: number): Edge {
	return `${r1},${c1}-${r2},${c2}`;
}

function nodeKey(row: number, col: number): NodeKey {
	return `${row},${col}`;
}

function parseNodeKey(key: NodeKey): GridPoint {
	const [row, col] = key.split(',').map(Number);
	return { row, col };
}

function graphEdgeKey(a: NodeKey, b: NodeKey): string {
	return a < b ? `${a}|${b}` : `${b}|${a}`;
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

function collectAdjacentEdgeCandidates(
	count: number,
	isDark: (r: number, c: number) => boolean
): EdgeCandidate[] {
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

	return candidates;
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
	const candidates = collectAdjacentEdgeCandidates(count, isDark);

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

function buildAllAdjacentEdges(
	count: number,
	isDark: (r: number, c: number) => boolean
): Set<Edge> {
	return new Set(collectAdjacentEdgeCandidates(count, isDark).map(({ key }) => key));
}

function getAllAdjacentEdges(
	cacheKey: string,
	count: number,
	isDark: (r: number, c: number) => boolean
): Set<Edge> {
	if (allAdjacentEdgesCache?.key === cacheKey) {
		return allAdjacentEdgesCache.value;
	}

	const edges = buildAllAdjacentEdges(count, isDark);
	allAdjacentEdgesCache = { key: cacheKey, value: edges };
	return edges;
}

function getConnectorEdges(
	cacheKey: string,
	count: number,
	isDark: (r: number, c: number) => boolean
): Set<Edge> {
	if (connectorEdgesCache?.key === cacheKey) {
		return connectorEdgesCache.value;
	}

	const edges = buildConnectorEdges(count, isDark);
	connectorEdgesCache = { key: cacheKey, value: edges };
	return edges;
}

function traceStrokeGraph(
	count: number,
	isDark: (r: number, c: number) => boolean,
	preventClosedLoops: boolean
): StrokeGraph {
	const edges = preventClosedLoops
		? buildConnectorEdges(count, isDark)
		: buildAllAdjacentEdges(count, isDark);
	const adjacency = new Map<NodeKey, Set<NodeKey>>();

	for (let row = 0; row < count; row++) {
		for (let col = 0; col < count; col++) {
			if (!isDark(row, col)) continue;
			adjacency.set(nodeKey(row, col), new Set());
		}
	}

	for (const edge of edges) {
		const [from, to] = edge.split('-') as [NodeKey, NodeKey];
		adjacency.get(from)?.add(to);
		adjacency.get(to)?.add(from);
	}

	const visitedEdges = new Set<string>();
	const paths: StrokePath[] = [];
	const sortedNodes = [...adjacency.keys()].sort();

	const sortedNeighbors = (key: NodeKey) => [...(adjacency.get(key) ?? [])].sort();

	const traceOpenPath = (start: NodeKey, next: NodeKey): StrokePath => {
		const points = [parseNodeKey(start), parseNodeKey(next)];
		visitedEdges.add(graphEdgeKey(start, next));

		let previous = start;
		let current = next;

		while ((adjacency.get(current)?.size ?? 0) === 2) {
			const candidate = sortedNeighbors(current).find(
				(neighbor) =>
					neighbor !== previous && !visitedEdges.has(graphEdgeKey(current, neighbor as NodeKey))
			) as NodeKey | undefined;

			if (!candidate) break;

			visitedEdges.add(graphEdgeKey(current, candidate));
			points.push(parseNodeKey(candidate));
			previous = current;
			current = candidate;
		}

		return { points, closed: false };
	};

	const traceClosedPath = (start: NodeKey, next: NodeKey): StrokePath => {
		const points = [parseNodeKey(start), parseNodeKey(next)];
		visitedEdges.add(graphEdgeKey(start, next));

		let previous = start;
		let current = next;

		while (current !== start) {
			const candidates = sortedNeighbors(current).filter(
				(neighbor) => neighbor !== previous
			) as NodeKey[];
			const candidate =
				candidates.find((neighbor) => !visitedEdges.has(graphEdgeKey(current, neighbor))) ??
				candidates[0];

			if (!candidate) break;

			visitedEdges.add(graphEdgeKey(current, candidate));
			if (candidate === start) break;

			points.push(parseNodeKey(candidate));
			previous = current;
			current = candidate;
		}

		return { points, closed: true };
	};

	for (const key of sortedNodes) {
		const degree = adjacency.get(key)?.size ?? 0;
		if (degree === 0 || degree === 2) continue;

		for (const neighbor of sortedNeighbors(key)) {
			if (visitedEdges.has(graphEdgeKey(key, neighbor))) continue;
			paths.push(traceOpenPath(key, neighbor as NodeKey));
		}
	}

	for (const key of sortedNodes) {
		for (const neighbor of sortedNeighbors(key)) {
			if (visitedEdges.has(graphEdgeKey(key, neighbor))) continue;
			paths.push(traceClosedPath(key, neighbor as NodeKey));
		}
	}

	const isolated = sortedNodes
		.filter((key) => (adjacency.get(key)?.size ?? 0) === 0)
		.map((key) => parseNodeKey(key));

	return { paths, isolated };
}

function getStrokeGraph(
	cacheKey: string,
	count: number,
	isDark: (r: number, c: number) => boolean,
	preventClosedLoops: boolean
): StrokeGraph {
	const strokeCacheKey = `${cacheKey}\u0001${preventClosedLoops ? 'pruned' : 'full'}`;
	if (strokeGraphCache?.key === strokeCacheKey) {
		return strokeGraphCache.value;
	}

	const graph = traceStrokeGraph(count, isDark, preventClosedLoops);
	strokeGraphCache = { key: strokeCacheKey, value: graph };
	return graph;
}

export const __test = {
	buildConnectorEdgesFromMatrix(matrix: boolean[][]): Set<Edge> {
		return buildConnectorEdges(matrix.length, (row, col) => matrix[row]?.[col] ?? false);
	},
	buildAllAdjacentEdgesFromMatrix(matrix: boolean[][]): Set<Edge> {
		return buildAllAdjacentEdges(matrix.length, (row, col) => matrix[row]?.[col] ?? false);
	},
	traceStrokeGraphFromMatrix(matrix: boolean[][], preventClosedLoops = true): StrokeGraph {
		return traceStrokeGraph(
			matrix.length,
			(row, col) => matrix[row]?.[col] ?? false,
			preventClosedLoops
		);
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

function rectPath(x: number, y: number, w: number, h: number): string {
	return `M${x},${y}H${x + w}V${y + h}H${x}Z`;
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

function shouldTraceStrokePaths(
	moduleStyle: ModuleStyle,
	dotSize: number,
	connectionMode: ConnectionMode
): boolean {
	return connectionMode === 'lines' && moduleStyle === 'rounded' && dotSize < 1;
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
	const useFullAdjacencyConnectors =
		connectionMode === 'lines' && moduleStyle === 'rounded' && dotSize >= 1;

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
	const ctx = canvas.getContext('2d')!;

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
