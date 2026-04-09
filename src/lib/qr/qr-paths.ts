import type { CapStyle, ModuleStyle } from './generate';
import { type Adj, DISCONNECTED_ADJ, ROUNDED_MODULE_RADIUS, exposedCorners } from './qr-topology';

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

export function rectPath(x: number, y: number, w: number, h: number): string {
	return `M${x},${y}H${x + w}V${y + h}H${x}Z`;
}

function octagonPath(x: number, y: number, s: number): string {
	const cut = s * 0.35;
	return miteredRectPath(x, y, s, s, [cut, cut, cut, cut]);
}

export function isStandaloneModule(adj: Adj): boolean {
	return !adj.top && !adj.right && !adj.bottom && !adj.left;
}

export function cappedRectPathData(
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

export function connectorPathData(
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

export function appendCappedRectCanvasPath(
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

export function appendConnectorCanvasPath(
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

export function drawModuleSvg(
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

export function connectorSvg(
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

export function drawModuleCanvas(
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

export function connectorCanvas(
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

function getStrokeLineCap(capStyle: CapStyle): CanvasLineCap {
	return capStyle === 'circle' ? 'round' : 'square';
}

function getStrokeLineJoin(capStyle: CapStyle): CanvasLineJoin {
	return capStyle === 'circle' ? 'round' : 'miter';
}

export function buildSvgStrokePath(
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

export function drawCanvasStrokePath(
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
