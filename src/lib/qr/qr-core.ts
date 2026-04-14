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
export const QR_OUTER_MARGIN_UNITS = 4;
export const ROUNDED_MODULE_RADIUS = 10;

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
	dotSize: number;
	fgColor: string;
	bgColor: string;
	logo?: string;
	frameText?: string;
}

export interface QRModules {
	count: number;
	isDark: (row: number, col: number) => boolean;
}

export interface Adj {
	top: boolean;
	right: boolean;
	bottom: boolean;
	left: boolean;
}

export interface GridPoint {
	row: number;
	col: number;
}

export interface StrokePath {
	points: GridPoint[];
	closed: boolean;
}

export interface StrokeGraph {
	paths: StrokePath[];
	isolated: GridPoint[];
}

export const DISCONNECTED_ADJ: Adj = {
	top: false,
	right: false,
	bottom: false,
	left: false
};
