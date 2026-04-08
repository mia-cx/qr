import qrcode from 'qrcode-generator';

export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';
export type ModuleStyle = 'square' | 'rounded' | 'dots' | 'diamond';

export interface QROptions {
	data: string;
	errorCorrection: ErrorCorrectionLevel;
	pixelSize: number; // 1-10
	moduleStyle: ModuleStyle;
	fgColor: string;
	bgColor: string;
	logo?: string; // data URL
	frameText?: string;
}

interface QRModules {
	count: number;
	isDark: (row: number, col: number) => boolean;
}

function generateQRModules(data: string, errorCorrection: ErrorCorrectionLevel): QRModules {
	const qr = qrcode(0, errorCorrection);
	qr.addData(data);
	qr.make();
	return {
		count: qr.getModuleCount(),
		isDark: (row: number, col: number) => qr.isDark(row, col)
	};
}

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

	for (let row = 0; row < count; row++) {
		for (let col = 0; col < count; col++) {
			if (modules.isDark(row, col)) {
				const x = margin + col * px;
				const y = margin + row * px;
				svg += drawModule(x, y, px, options.moduleStyle, safeFg);
			}
		}
	}

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

function drawModule(x: number, y: number, size: number, style: ModuleStyle, color: string): string {
	switch (style) {
		case 'square':
			return `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${color}"/>`;
		case 'rounded': {
			const r = size * 0.3;
			return `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${r}" fill="${color}"/>`;
		}
		case 'dots': {
			const cx = x + size / 2;
			const cy = y + size / 2;
			const r = size * 0.45;
			return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>`;
		}
		case 'diamond': {
			const cx = x + size / 2;
			const cy = y + size / 2;
			const h = size * 0.5;
			return `<polygon points="${cx},${cy - h} ${cx + h},${cy} ${cx},${cy + h} ${cx - h},${cy}" fill="${color}"/>`;
		}
	}
}

function escapeXml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

export function generateQRCanvas(canvas: HTMLCanvasElement, options: QROptions): void {
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

	for (let row = 0; row < count; row++) {
		for (let col = 0; col < count; col++) {
			if (modules.isDark(row, col)) {
				const x = margin + col * px;
				const y = margin + row * px;
				drawModuleCanvas(ctx, x, y, px, options.moduleStyle, options.fgColor);
			}
		}
	}

	if (options.logo) {
		const logoSize = qrSize * 0.25;
		const logoX = margin + (qrSize - logoSize) / 2;
		const logoY = margin + (qrSize - logoSize) / 2;
		const logoPad = px;

		ctx.fillStyle = options.bgColor;
		ctx.beginPath();
		ctx.roundRect(logoX - logoPad, logoY - logoPad, logoSize + logoPad * 2, logoSize + logoPad * 2, px);
		ctx.fill();

		const img = new Image();
		img.src = options.logo;
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

function drawModuleCanvas(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	size: number,
	style: ModuleStyle,
	color: string
): void {
	ctx.fillStyle = color;
	switch (style) {
		case 'square':
			ctx.fillRect(x, y, size, size);
			break;
		case 'rounded': {
			const r = size * 0.3;
			ctx.beginPath();
			ctx.roundRect(x, y, size, size, r);
			ctx.fill();
			break;
		}
		case 'dots': {
			const cx = x + size / 2;
			const cy = y + size / 2;
			ctx.beginPath();
			ctx.arc(cx, cy, size * 0.45, 0, Math.PI * 2);
			ctx.fill();
			break;
		}
		case 'diamond': {
			const cx = x + size / 2;
			const cy = y + size / 2;
			const h = size * 0.5;
			ctx.beginPath();
			ctx.moveTo(cx, cy - h);
			ctx.lineTo(cx + h, cy);
			ctx.lineTo(cx, cy + h);
			ctx.lineTo(cx - h, cy);
			ctx.closePath();
			ctx.fill();
			break;
		}
	}
}
