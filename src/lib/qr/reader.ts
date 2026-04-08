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
	return { data: '', success: false, error: 'No QR code found in image' };
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
