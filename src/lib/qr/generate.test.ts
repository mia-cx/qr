import { describe, expect, it } from 'vitest';

import { generateQRSvg, type QROptions } from './generate';

const baseOptions: QROptions = {
	data: 'https://mia.cx',
	errorCorrection: 'M',
	pixelSize: 6,
	moduleStyle: 'square',
	fgColor: '#111111',
	bgColor: '#fafafa',
	frameText: ''
};

describe('generateQRSvg', () => {
	it('returns an empty string when there is no QR payload', () => {
		expect(generateQRSvg({ ...baseOptions, data: '' })).toBe('');
	});

	it('renders svg markup with the configured colors and escaped frame text', () => {
		const svg = generateQRSvg({
			...baseOptions,
			frameText: 'mia <qr> & friends'
		});

		expect(svg).toContain('<svg');
		expect(svg).toContain('fill="#fafafa"');
		expect(svg).toContain('fill="#111111"');
		expect(svg).toContain('mia &lt;qr&gt; &amp; friends');
	});

	it.each(['L', 'M', 'Q', 'H'] as const)(
		'accepts %s error correction without throwing',
		(errorCorrection) => {
			expect(
				generateQRSvg({
					...baseOptions,
					errorCorrection
				})
			).toContain('<svg');
		}
	);
});
