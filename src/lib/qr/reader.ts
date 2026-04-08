import jsQR from 'jsqr';

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

export async function readQRFromFile(file: File): Promise<QRReadResult> {
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => {
			const canvas = document.createElement('canvas');
			canvas.width = img.width;
			canvas.height = img.height;
			const ctx = canvas.getContext('2d')!;
			ctx.drawImage(img, 0, 0);
			const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
			resolve(readQRFromImageData(imageData));
		};
		img.onerror = () => {
			resolve({ data: '', success: false, error: 'Failed to load image' });
		};
		img.src = URL.createObjectURL(file);
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
