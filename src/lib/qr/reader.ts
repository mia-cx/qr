import jsQR from 'jsqr';

const MAX_INPUT_FILE_BYTES = 12 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 4_000_000;

export interface QRReadResult {
	data: string;
	success: boolean;
	error?: string;
}

export function readQRFromImageData(imageData: ImageData): QRReadResult {
	const result = jsQR(imageData.data, imageData.width, imageData.height);
	if (result) {
		return { data: result.data, success: true };
	}

	// Fallback: dilate dark regions so sub-cell dots fill their module.
	// This helps jsQR read QR codes rendered with small dot sizes where
	// the gap between dots confuses the binarizer.
	const dilated = dilateDark(imageData);
	const retryResult = jsQR(dilated.data, dilated.width, dilated.height);
	if (retryResult) {
		return { data: retryResult.data, success: true };
	}

	return { data: '', success: false, error: 'No QR code found in image' };
}

/**
 * Morphological dilation of dark pixels: for each pixel, replace it with
 * the darkest pixel in a small neighborhood. This expands dots outward
 * from their centers so they fill more of each QR module cell.
 *
 * Uses luminance (0.299R + 0.587G + 0.114B) for "darkness" comparison,
 * with a 2px radius box kernel — enough to bridge typical dot-to-cell gaps
 * without merging separate modules at common pixel sizes (3:1–12:1).
 */
export function dilateDark(imageData: ImageData): ImageData {
	const { width, height, data } = imageData;
	const out = new Uint8ClampedArray(data.length);
	const radius = 2;

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const idx = (y * width + x) * 4;
			let darkestLum = 255;
			let darkestIdx = idx;

			const yMin = Math.max(0, y - radius);
			const yMax = Math.min(height - 1, y + radius);
			const xMin = Math.max(0, x - radius);
			const xMax = Math.min(width - 1, x + radius);

			for (let ny = yMin; ny <= yMax; ny++) {
				for (let nx = xMin; nx <= xMax; nx++) {
					const nIdx = (ny * width + nx) * 4;
					const lum = data[nIdx] * 0.299 + data[nIdx + 1] * 0.587 + data[nIdx + 2] * 0.114;
					if (lum < darkestLum) {
						darkestLum = lum;
						darkestIdx = nIdx;
					}
				}
			}

			out[idx] = data[darkestIdx];
			out[idx + 1] = data[darkestIdx + 1];
			out[idx + 2] = data[darkestIdx + 2];
			out[idx + 3] = data[idx + 3]; // preserve original alpha
		}
	}

	return { data: out, width, height, colorSpace: 'srgb' as PredefinedColorSpace } as ImageData;
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
