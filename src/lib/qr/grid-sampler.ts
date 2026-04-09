/**
 * QR grid detection and center-sampling.
 *
 * jsQR's built-in binarizer uses 8×8 blocks, which fails when QR modules
 * are rendered with small dots — the background gaps between dots dilute
 * each block's average, producing garbage binarization. This module
 * bypasses jsQR's binarizer entirely:
 *
 * 1. Compute grayscale luminance from RGBA
 * 2. Binarize with Otsu's global threshold (bimodal: works well for our
 *    two-color QR codes)
 * 3. Scan rows/cols for the 1:1:3:1:1 finder pattern ratio
 * 4. Cluster detections into three finder patterns
 * 5. Derive module size and grid bounds
 * 6. Sample the center pixel of each module from the ORIGINAL grayscale
 * 7. Emit a clean 10px-per-module image for jsQR to decode
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FinderPattern {
	cx: number;
	cy: number;
	moduleSize: number;
}

interface GridInfo {
	topLeft: FinderPattern;
	topRight: FinderPattern;
	bottomLeft: FinderPattern;
	moduleSize: number;
	moduleCount: number;
	/** Top-left corner of module (0,0) in image pixels. */
	originX: number;
	originY: number;
}

// ---------------------------------------------------------------------------
// Grayscale + Otsu binarization
// ---------------------------------------------------------------------------

export function toGrayscale(data: Uint8ClampedArray, width: number, height: number): Uint8Array {
	const gray = new Uint8Array(width * height);
	for (let i = 0; i < gray.length; i++) {
		const off = i * 4;
		gray[i] = Math.round(data[off] * 0.299 + data[off + 1] * 0.587 + data[off + 2] * 0.114);
	}
	return gray;
}

/** Otsu's method: find the threshold that minimizes intra-class variance. */
export function otsuThreshold(gray: Uint8Array): number {
	const hist = new Uint32Array(256);
	for (let i = 0; i < gray.length; i++) hist[gray[i]]++;

	const total = gray.length;
	let sumAll = 0;
	for (let i = 0; i < 256; i++) sumAll += i * hist[i];

	let sumBg = 0;
	let weightBg = 0;
	let best = 0;
	let bestThreshold = 0;

	for (let t = 0; t < 256; t++) {
		weightBg += hist[t];
		if (weightBg === 0) continue;
		const weightFg = total - weightBg;
		if (weightFg === 0) break;

		sumBg += t * hist[t];
		const meanBg = sumBg / weightBg;
		const meanFg = (sumAll - sumBg) / weightFg;
		const diff = meanBg - meanFg;
		const variance = weightBg * weightFg * diff * diff;

		if (variance > best) {
			best = variance;
			bestThreshold = t;
		}
	}

	return bestThreshold;
}

export function binarize(gray: Uint8Array, threshold: number): Uint8Array {
	const binary = new Uint8Array(gray.length);
	for (let i = 0; i < gray.length; i++) {
		binary[i] = gray[i] <= threshold ? 1 : 0; // 1 = dark, 0 = light
	}
	return binary;
}

// ---------------------------------------------------------------------------
// Finder pattern detection
// ---------------------------------------------------------------------------

const RATIO_TOLERANCE = 0.5; // each segment within ±50% of expected

interface RunSegment {
	x: number;
	y: number;
	runs: number[];
	moduleSize: number;
}

/**
 * Check if 5 consecutive run lengths match the 1:1:3:1:1 ratio.
 * Returns the estimated module size, or 0 if no match.
 */
function checkFinderRatio(runs: number[]): number {
	const total = runs[0] + runs[1] + runs[2] + runs[3] + runs[4];
	if (total < 7) return 0;

	const unit = total / 7;

	for (let i = 0; i < 5; i++) {
		const expected = i === 2 ? unit * 3 : unit;
		if (Math.abs(runs[i] - expected) > expected * RATIO_TOLERANCE) return 0;
	}

	return unit;
}

function scanLineForFinders(
	binary: Uint8Array,
	width: number,
	y: number,
	isRow: boolean,
	lineLength: number
): RunSegment[] {
	const segments: RunSegment[] = [];
	const runs = [0, 0, 0, 0, 0];
	let runIdx = 0;
	let currentColor = -1;

	for (let pos = 0; pos < lineLength; pos++) {
		const idx = isRow ? y * width + pos : pos * width + y;
		const pixel = binary[idx];

		if (pixel === currentColor) {
			runs[runIdx]++;
		} else {
			if (runIdx === 4) {
				const unit = checkFinderRatio(runs);
				if (unit > 0) {
					const center = pos - runs[4] - runs[3] - runs[2] / 2;
					segments.push({
						x: isRow ? Math.round(center) : y,
						y: isRow ? y : Math.round(center),
						runs: [...runs],
						moduleSize: unit
					});
				}
				// Shift runs left by 2
				runs[0] = runs[2];
				runs[1] = runs[3];
				runs[2] = runs[4];
				runs[3] = 1;
				runs[4] = 0;
				runIdx = 3;
			} else {
				runIdx++;
				runs[runIdx] = 1;
			}
			currentColor = pixel;
		}
	}

	// Check final runs
	if (runIdx === 4) {
		const unit = checkFinderRatio(runs);
		if (unit > 0) {
			const center = lineLength - runs[4] - runs[3] - runs[2] / 2;
			segments.push({
				x: isRow ? Math.round(center) : y,
				y: isRow ? y : Math.round(center),
				runs: [...runs],
				moduleSize: unit
			});
		}
	}

	return segments;
}

function distance(a: { cx: number; cy: number }, b: { cx: number; cy: number }): number {
	return Math.sqrt((a.cx - b.cx) ** 2 + (a.cy - b.cy) ** 2);
}

/**
 * Cluster nearby finder pattern detections and return their centroids.
 */
function clusterDetections(detections: RunSegment[]): FinderPattern[] {
	if (detections.length === 0) return [];

	const clusters: { points: RunSegment[]; cx: number; cy: number; moduleSize: number }[] = [];

	for (const det of detections) {
		let merged = false;
		for (const cluster of clusters) {
			const dist = Math.sqrt((det.x - cluster.cx) ** 2 + (det.y - cluster.cy) ** 2);
			if (dist < cluster.moduleSize * 5) {
				cluster.points.push(det);
				// Recompute centroid
				let sx = 0, sy = 0, sm = 0;
				for (const p of cluster.points) {
					sx += p.x;
					sy += p.y;
					sm += p.moduleSize;
				}
				cluster.cx = sx / cluster.points.length;
				cluster.cy = sy / cluster.points.length;
				cluster.moduleSize = sm / cluster.points.length;
				merged = true;
				break;
			}
		}
		if (!merged) {
			clusters.push({
				points: [det],
				cx: det.x,
				cy: det.y,
				moduleSize: det.moduleSize
			});
		}
	}

	// Only keep clusters with enough detections (at least 3 — some row + some column hits)
	return clusters
		.filter((c) => c.points.length >= 3)
		.map((c) => ({
			cx: Math.round(c.cx),
			cy: Math.round(c.cy),
			moduleSize: c.moduleSize
		}));
}

export function findFinderPatterns(
	binary: Uint8Array,
	width: number,
	height: number
): FinderPattern[] {
	const detections: RunSegment[] = [];

	// Scan rows
	for (let y = 0; y < height; y++) {
		detections.push(...scanLineForFinders(binary, width, y, true, width));
	}

	// Scan columns
	for (let x = 0; x < width; x++) {
		detections.push(...scanLineForFinders(binary, width, x, false, height));
	}

	return clusterDetections(detections);
}

// ---------------------------------------------------------------------------
// Grid computation
// ---------------------------------------------------------------------------

/**
 * Given three finder patterns, identify which is top-left, top-right,
 * and bottom-left, then compute the grid parameters.
 *
 * The top-left pattern is the one that forms the smallest angle at its
 * vertex when connecting all three patterns.
 */
export function computeGrid(patterns: FinderPattern[]): GridInfo | null {
	if (patterns.length < 3) return null;

	// Take the 3 patterns with the most consistent module sizes
	const sorted = [...patterns].sort((a, b) => b.moduleSize - a.moduleSize);
	const candidates = sorted.slice(0, 3);

	// Find the pattern that is the "corner" (top-left) — it's the one
	// where the angle formed by the other two patterns is closest to 90°
	let bestCorner = 0;
	let bestAngleError = Infinity;

	for (let i = 0; i < 3; i++) {
		const a = candidates[i];
		const b = candidates[(i + 1) % 3];
		const c = candidates[(i + 2) % 3];

		// Vector from a to b and a to c
		const abx = b.cx - a.cx;
		const aby = b.cy - a.cy;
		const acx = c.cx - a.cx;
		const acy = c.cy - a.cy;

		// Cross product magnitude gives sin(angle) * |ab| * |ac|
		const cross = Math.abs(abx * acy - aby * acx);
		const dot = Math.abs(abx * acx + aby * acy);

		// For a perfect 90° angle, dot product should be 0
		// Error metric: how far from perpendicular
		const error = dot / (cross + 1);
		if (error < bestAngleError) {
			bestAngleError = error;
			bestCorner = i;
		}
	}

	const topLeft = candidates[bestCorner];
	const pB = candidates[(bestCorner + 1) % 3];
	const pC = candidates[(bestCorner + 2) % 3];

	// Determine which is top-right vs bottom-left using cross product
	// Top-right is to the right of the top-left → bottom-left vector
	const cross = (pB.cx - topLeft.cx) * (pC.cy - topLeft.cy) -
		(pB.cy - topLeft.cy) * (pC.cx - topLeft.cx);

	const [topRight, bottomLeft] = cross > 0 ? [pC, pB] : [pB, pC];

	// Module size: average of all three patterns
	const moduleSize = (topLeft.moduleSize + topRight.moduleSize + bottomLeft.moduleSize) / 3;

	// Distance between finder pattern centers = (moduleCount - 7) modules
	// (each finder is centered at 3.5 modules from its corner)
	const topDist = distance(topLeft, topRight);
	const leftDist = distance(topLeft, bottomLeft);
	const avgDist = (topDist + leftDist) / 2;

	// moduleCount must be odd and ≥ 21 (version 1)
	let rawCount = Math.round(avgDist / moduleSize) + 7;
	if (rawCount < 21) rawCount = 21;
	if (rawCount % 2 === 0) rawCount++; // must be odd

	// Origin: top-left finder center is at module (3.5, 3.5)
	const originX = topLeft.cx - 3.5 * moduleSize;
	const originY = topLeft.cy - 3.5 * moduleSize;

	return {
		topLeft,
		topRight,
		bottomLeft,
		moduleSize,
		moduleCount: rawCount,
		originX,
		originY
	};
}

// ---------------------------------------------------------------------------
// Center-sample and reconstruct
// ---------------------------------------------------------------------------

const OUTPUT_PX_PER_MODULE = 10;

/**
 * Sample the center of each QR module from the original grayscale image,
 * then reconstruct a clean binary image at OUTPUT_PX_PER_MODULE resolution.
 */
export function sampleGrid(
	gray: Uint8Array,
	width: number,
	height: number,
	grid: GridInfo
): { data: Uint8ClampedArray; width: number; height: number } {
	const { moduleCount, moduleSize, originX, originY } = grid;
	const outSize = moduleCount * OUTPUT_PX_PER_MODULE;
	const out = new Uint8ClampedArray(outSize * outSize * 4);

	// Determine if the QR code is dark-on-light or light-on-dark by
	// checking the center of the top-left finder pattern's dark core.
	// The center 3×3 of a finder should be the "dark" color.
	const centerSample = samplePixel(gray, width, height, grid.topLeft.cx, grid.topLeft.cy);
	// Compare with a corner pixel (should be background)
	const bgSample = samplePixel(gray, width, height,
		Math.round(originX - moduleSize), Math.round(originY - moduleSize));
	const inverted = centerSample > bgSample; // center is lighter = inverted

	// Threshold: midpoint between fg and bg luminance
	const fgLum = inverted ? centerSample : bgSample < centerSample ? bgSample : centerSample;
	const bgLumVal = inverted ? bgSample : bgSample > centerSample ? bgSample : centerSample;
	const threshold = (fgLum + bgLumVal) / 2;

	for (let row = 0; row < moduleCount; row++) {
		for (let col = 0; col < moduleCount; col++) {
			// Center of this module in the source image
			const srcX = originX + (col + 0.5) * moduleSize;
			const srcY = originY + (row + 0.5) * moduleSize;

			// Sample a small area around center (3×3 average) for noise robustness
			const lum = sampleArea(gray, width, height, srcX, srcY, Math.max(1, moduleSize * 0.2));

			// Is this module "dark"?
			const isDark = inverted ? lum > threshold : lum < threshold;
			const color = isDark ? 0 : 255;

			// Fill the output block
			for (let py = 0; py < OUTPUT_PX_PER_MODULE; py++) {
				for (let px = 0; px < OUTPUT_PX_PER_MODULE; px++) {
					const outIdx = ((row * OUTPUT_PX_PER_MODULE + py) * outSize + (col * OUTPUT_PX_PER_MODULE + px)) * 4;
					out[outIdx] = color;
					out[outIdx + 1] = color;
					out[outIdx + 2] = color;
					out[outIdx + 3] = 255;
				}
			}
		}
	}

	return { data: out, width: outSize, height: outSize };
}

function samplePixel(gray: Uint8Array, width: number, height: number, x: number, y: number): number {
	const px = Math.round(Math.max(0, Math.min(width - 1, x)));
	const py = Math.round(Math.max(0, Math.min(height - 1, y)));
	return gray[py * width + px];
}

/** Average luminance in a small square region. */
function sampleArea(
	gray: Uint8Array,
	width: number,
	height: number,
	cx: number,
	cy: number,
	radius: number
): number {
	const r = Math.max(1, Math.round(radius));
	const xMin = Math.max(0, Math.round(cx - r));
	const xMax = Math.min(width - 1, Math.round(cx + r));
	const yMin = Math.max(0, Math.round(cy - r));
	const yMax = Math.min(height - 1, Math.round(cy + r));

	let sum = 0;
	let count = 0;
	for (let y = yMin; y <= yMax; y++) {
		for (let x = xMin; x <= xMax; x++) {
			sum += gray[y * width + x];
			count++;
		}
	}

	return count > 0 ? sum / count : 128;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Attempt to detect the QR grid via finder patterns and sample module
 * centers from the raw image. Returns a clean binary ImageData suitable
 * for jsQR, or null if grid detection fails.
 */
export function centerSampleQR(
	imageData: { data: Uint8ClampedArray; width: number; height: number }
): { data: Uint8ClampedArray; width: number; height: number } | null {
	const { data, width, height } = imageData;
	const gray = toGrayscale(data, width, height);
	const threshold = otsuThreshold(gray);
	const binary = binarize(gray, threshold);

	const patterns = findFinderPatterns(binary, width, height);
	if (patterns.length < 3) {
		// Try inverted
		const invBinary = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) invBinary[i] = binary[i] ? 0 : 1;
		const invPatterns = findFinderPatterns(invBinary, width, height);
		if (invPatterns.length < 3) return null;

		const grid = computeGrid(invPatterns);
		if (!grid) return null;
		return sampleGrid(gray, width, height, grid);
	}

	const grid = computeGrid(patterns);
	if (!grid) return null;
	return sampleGrid(gray, width, height, grid);
}
