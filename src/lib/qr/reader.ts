import jsQR from 'jsqr';

const MAX_INPUT_FILE_BYTES = 12 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 4_000_000;
const MIN_QR_MODULE_COUNT = 21;
const MAX_QR_MODULE_COUNT = 177;
const QR_MODULE_COUNT_STEP = 4;
const SYNTHETIC_QUIET_ZONE_MODULES = 4;
const SYNTHETIC_MODULE_SCALE = 8;
const MIN_CONTRAST_DELTA = 24;

type ImageLike = Pick<ImageData, 'data' | 'width' | 'height'>;

export interface QRReadResult {
	data: string;
	success: boolean;
	error?: string;
}

export function readQRFromImageData(imageData: ImageData): QRReadResult {
	const result = decodeQrImage(imageData);
	if (result) {
		return { data: result.data, success: true };
	}
	return { data: '', success: false, error: 'No QR code found in image' };
}

function decodeQrImage(imageData: ImageLike) {
	const directResult = jsQR(imageData.data, imageData.width, imageData.height);
	if (directResult) {
		return directResult;
	}

	return decodeWithCenterSamplingFallback(imageData);
}

function decodeWithCenterSamplingFallback(imageData: ImageLike) {
	const grayscale = toGrayscale(imageData);
	const threshold = estimateDarkThreshold(grayscale, imageData.width, imageData.height);
	if (threshold === null) {
		return null;
	}

	const bounds = findDarkBounds(grayscale, imageData.width, imageData.height, threshold);
	if (!bounds) {
		return null;
	}

	for (
		let moduleCount = MIN_QR_MODULE_COUNT;
		moduleCount <= MAX_QR_MODULE_COUNT;
		moduleCount += QR_MODULE_COUNT_STEP
	) {
		const moduleSize = bounds.size / moduleCount;
		if (moduleSize < 2 || !Number.isFinite(moduleSize)) {
			continue;
		}

		const sampledImage = buildCenterSampledQrImage(
			grayscale,
			imageData.width,
			imageData.height,
			bounds,
			moduleCount,
			threshold
		);
		const result = jsQR(sampledImage.data, sampledImage.width, sampledImage.height);
		if (result) {
			return result;
		}
	}

	return null;
}

function toGrayscale(imageData: ImageLike): Uint8Array {
	const grayscale = new Uint8Array(imageData.width * imageData.height);

	for (let pixelIndex = 0; pixelIndex < grayscale.length; pixelIndex++) {
		const offset = pixelIndex * 4;
		const red = imageData.data[offset] ?? 255;
		const green = imageData.data[offset + 1] ?? 255;
		const blue = imageData.data[offset + 2] ?? 255;
		const alpha = imageData.data[offset + 3] ?? 255;
		const blended =
			alpha >= 255
				? [red, green, blue]
				: [
						255 - ((255 - red) * alpha) / 255,
						255 - ((255 - green) * alpha) / 255,
						255 - ((255 - blue) * alpha) / 255
					];
		grayscale[pixelIndex] = Math.round(
			blended[0] * 0.299 + blended[1] * 0.587 + blended[2] * 0.114
		);
	}

	return grayscale;
}

function estimateDarkThreshold(
	grayscale: Uint8Array,
	width: number,
	height: number
): number | null {
	const borderValues: number[] = [];
	const borderThickness = Math.max(1, Math.floor(Math.min(width, height) * 0.08));

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (
				x < borderThickness ||
				y < borderThickness ||
				x >= width - borderThickness ||
				y >= height - borderThickness
			) {
				borderValues.push(grayscale[y * width + x] ?? 255);
			}
		}
	}

	if (!borderValues.length) {
		return null;
	}

	borderValues.sort((a, b) => a - b);
	const background = borderValues[Math.floor(borderValues.length / 2)] ?? 255;
	let darkest = 255;
	for (const value of grayscale) {
		if (value < darkest) darkest = value;
	}

	if (background - darkest < MIN_CONTRAST_DELTA) {
		return null;
	}

	return Math.round((background + darkest) / 2);
}

function findDarkBounds(
	grayscale: Uint8Array,
	width: number,
	height: number,
	threshold: number
): { x: number; y: number; size: number } | null {
	let minX = width;
	let minY = height;
	let maxX = -1;
	let maxY = -1;

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if ((grayscale[y * width + x] ?? 255) > threshold) {
				continue;
			}

			if (x < minX) minX = x;
			if (y < minY) minY = y;
			if (x > maxX) maxX = x;
			if (y > maxY) maxY = y;
		}
	}

	if (maxX < minX || maxY < minY) {
		return null;
	}

	const boxWidth = maxX - minX + 1;
	const boxHeight = maxY - minY + 1;
	const size = Math.max(boxWidth, boxHeight);
	if (size < MIN_QR_MODULE_COUNT * 2) {
		return null;
	}

	const centerX = (minX + maxX) / 2;
	const centerY = (minY + maxY) / 2;
	const x = clamp(Math.round(centerX - size / 2), 0, Math.max(width - size, 0));
	const y = clamp(Math.round(centerY - size / 2), 0, Math.max(height - size, 0));

	return { x, y, size };
}

function buildCenterSampledQrImage(
	grayscale: Uint8Array,
	width: number,
	height: number,
	bounds: { x: number; y: number; size: number },
	moduleCount: number,
	threshold: number
): ImageLike {
	const outputModuleCount = moduleCount + SYNTHETIC_QUIET_ZONE_MODULES * 2;
	const outputWidth = outputModuleCount * SYNTHETIC_MODULE_SCALE;
	const outputHeight = outputWidth;
	const output = new Uint8ClampedArray(outputWidth * outputHeight * 4);
	output.fill(255);

	const moduleSize = bounds.size / moduleCount;

	for (let row = 0; row < moduleCount; row++) {
		for (let col = 0; col < moduleCount; col++) {
			if (
				!isDarkModuleAtCenter(
					grayscale,
					width,
					height,
					bounds.x,
					bounds.y,
					moduleSize,
					row,
					col,
					threshold
				)
			) {
				continue;
			}

			fillOutputModule(output, outputWidth, row, col);
		}
	}

	return {
		data: output,
		width: outputWidth,
		height: outputHeight
	};
}

function isDarkModuleAtCenter(
	grayscale: Uint8Array,
	width: number,
	height: number,
	originX: number,
	originY: number,
	moduleSize: number,
	row: number,
	col: number,
	threshold: number
): boolean {
	let darkVotes = 0;
	let samples = 0;
	const offsets = [-0.18, 0, 0.18];

	for (const yOffset of offsets) {
		for (const xOffset of offsets) {
			const sampleX = clamp(
				Math.round(originX + (col + 0.5 + xOffset) * moduleSize),
				0,
				width - 1
			);
			const sampleY = clamp(
				Math.round(originY + (row + 0.5 + yOffset) * moduleSize),
				0,
				height - 1
			);
			if ((grayscale[sampleY * width + sampleX] ?? 255) <= threshold) {
				darkVotes++;
			}
			samples++;
		}
	}

	return darkVotes >= Math.ceil(samples / 2);
}

function fillOutputModule(
	output: Uint8ClampedArray,
	outputWidth: number,
	row: number,
	col: number
) {
	const startX = (col + SYNTHETIC_QUIET_ZONE_MODULES) * SYNTHETIC_MODULE_SCALE;
	const startY = (row + SYNTHETIC_QUIET_ZONE_MODULES) * SYNTHETIC_MODULE_SCALE;

	for (let y = 0; y < SYNTHETIC_MODULE_SCALE; y++) {
		for (let x = 0; x < SYNTHETIC_MODULE_SCALE; x++) {
			const offset = ((startY + y) * outputWidth + startX + x) * 4;
			output[offset] = 0;
			output[offset + 1] = 0;
			output[offset + 2] = 0;
			output[offset + 3] = 255;
		}
	}
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

export function constrainImageDimensions(
	width: number,
	height: number,
	maxPixels = MAX_IMAGE_PIXELS
): { width: number; height: number } {
	if (width <= 0 || height <= 0) return { width: 0, height: 0 };

	const totalPixels = width * height;
	if (totalPixels <= maxPixels) {
		return { width, height };
	}

	const scale = Math.sqrt(maxPixels / totalPixels);
	return {
		width: Math.max(1, Math.floor(width * scale)),
		height: Math.max(1, Math.floor(height * scale))
	};
}

export async function readQRFromFile(file: File): Promise<QRReadResult> {
	if (file.size > MAX_INPUT_FILE_BYTES) {
		return { data: '', success: false, error: 'Image is too large to scan safely' };
	}

	return new Promise((resolve) => {
		const img = new Image();
		const objectUrl = URL.createObjectURL(file);

		img.onload = () => {
			const { width, height } = constrainImageDimensions(img.width, img.height);
			if (!width || !height) {
				URL.revokeObjectURL(objectUrl);
				resolve({ data: '', success: false, error: 'Failed to load image' });
				return;
			}

			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext('2d')!;
			ctx.drawImage(img, 0, 0, width, height);
			const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
			URL.revokeObjectURL(objectUrl);
			resolve(readQRFromImageData(imageData));
		};
		img.onerror = () => {
			URL.revokeObjectURL(objectUrl);
			resolve({ data: '', success: false, error: 'Failed to load image' });
		};
		img.src = objectUrl;
	});
}

export async function readQRFromClipboard(): Promise<QRReadResult> {
	try {
		const items = await navigator.clipboard.read();
		for (const item of items) {
			const imageType = item.types.find((t) => t.startsWith('image/'));
			if (imageType) {
				const blob = await item.getType(imageType);
				const file = new File([blob], 'clipboard.png', { type: imageType });
				return readQRFromFile(file);
			}
		}
		return { data: '', success: false, error: 'No image found in clipboard' };
	} catch {
		return { data: '', success: false, error: 'Clipboard access denied' };
	}
}

export function createScreenCapture(
	onFrame: (imageData: ImageData) => void,
	onError: (err: string) => void
): { start: () => Promise<void>; stop: () => void } {
	let stream: MediaStream | null = null;
	let animationId: number | null = null;
	let video: HTMLVideoElement | null = null;

	async function start() {
		try {
			stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
			stream.getVideoTracks()[0]?.addEventListener('ended', () => {
				stop();
			});
			video = document.createElement('video');
			video.srcObject = stream;
			video.playsInline = true;
			await video.play();

			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d')!;

			function scan() {
				if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
					animationId = requestAnimationFrame(scan);
					return;
				}
				canvas.width = video.videoWidth;
				canvas.height = video.videoHeight;
				ctx.drawImage(video, 0, 0);
				const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
				onFrame(imageData);
				animationId = requestAnimationFrame(scan);
			}

			scan();
		} catch {
			onError('Screen capture denied or unavailable');
		}
	}

	function stop() {
		if (animationId !== null) cancelAnimationFrame(animationId);
		if (stream) stream.getTracks().forEach((t) => t.stop());
		stream = null;
		video = null;
	}

	return { start, stop };
}
