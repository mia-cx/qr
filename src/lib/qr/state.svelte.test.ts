import { setPersistentEngine } from '@nanostores/persistent';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('qrState', () => {
	const storage: Record<string, string> = {};

	beforeEach(() => {
		vi.resetModules();

		for (const key of Object.keys(storage)) {
			delete storage[key];
		}

		setPersistentEngine(storage, {
			addEventListener() {},
			removeEventListener() {}
		});
	});

	it('hydrates from the persisted nanostore snapshot on startup', async () => {
		storage['qr-draft'] = JSON.stringify({
			payloadType: 'email',
			payloads: {
				email: {
					to: 'mia@example.com',
					subject: 'Saved',
					body: 'Draft'
				}
			},
			errorCorrection: 'Q',
			pixelSize: 12,
			moduleStyle: 'rounded',
			fgColor: '#112233',
			bgColor: '#fefefe',
			frameText: 'hydrate me'
		});

		const { qrState } = await import('./state.svelte');

		expect(qrState.payloadType).toBe('email');
		expect(qrState.payloads.email).toEqual({
			to: 'mia@example.com',
			subject: 'Saved',
			body: 'Draft'
		});
		expect(qrState.errorCorrection).toBe('Q');
		expect(qrState.pixelSize).toBe(12);
		expect(qrState.moduleStyle).toBe('rounded');
		expect(qrState.connectionMode).toBe('lines');
		expect(qrState.fgColor).toBe('#112233');
		expect(qrState.bgColor).toBe('#fefefe');
		expect(qrState.frameText).toBe('hydrate me');
	});

	it('writes user edits back through the nanostore', async () => {
		const { qrState } = await import('./state.svelte');

		qrState.setPayloadType('phone');
		qrState.setPayloadField('phone', 'number', '+31 6 1234 5678');
		qrState.setErrorCorrection('H');
		qrState.setPixelSize(10);

		expect(JSON.parse(storage['qr-draft'])).toMatchObject({
			payloadType: 'phone',
			payloads: {
				phone: { number: '+31 6 1234 5678' }
			},
			errorCorrection: 'H',
			pixelSize: 10
		});
	});

	it('clamps dot size to the minimum supported amount before persisting', async () => {
		const { qrState } = await import('./state.svelte');

		qrState.setPixelSize(6);
		qrState.setDotSize(0.3);

		expect(qrState.dotSize).toBeCloseTo(1 / 3);
		expect(JSON.parse(storage['qr-draft'])).toMatchObject({
			pixelSize: 6,
			dotSize: 1 / 3
		});
	});

	it('snaps dot size to pixel-perfect divisions of the current pixel ratio', async () => {
		const { qrState } = await import('./state.svelte');

		qrState.setPixelSize(6);
		qrState.setDotSize(0.7);

		expect(qrState.dotSize).toBeCloseTo(2 / 3);
		expect(JSON.parse(storage['qr-draft'])).toMatchObject({
			pixelSize: 6,
			dotSize: 2 / 3
		});
	});

	it('resets dot size to 100% when the pixel ratio drops below 3', async () => {
		const { qrState } = await import('./state.svelte');

		qrState.setPixelSize(6);
		qrState.setDotSize(2 / 3);
		qrState.setPixelSize(2);

		expect(qrState.dotSize).toBe(1);
		expect(JSON.parse(storage['qr-draft'])).toMatchObject({
			pixelSize: 2,
			dotSize: 1
		});
	});

	it('falls back to square caps when the pixel ratio drops below 8:1', async () => {
		const { qrState } = await import('./state.svelte');

		qrState.setPixelSize(10);
		qrState.setCapStyle('circle');
		qrState.setPixelSize(6);

		expect(qrState.capStyle).toBe('square');
		expect(JSON.parse(storage['qr-draft'])).toMatchObject({
			pixelSize: 6,
			capStyle: 'square'
		});
	});

	it('rejects decorative caps below 8:1 even when explicitly selected', async () => {
		const { qrState } = await import('./state.svelte');

		qrState.setPixelSize(6);
		qrState.setCapStyle('miter');

		expect(qrState.capStyle).toBe('square');
		expect(JSON.parse(storage['qr-draft'])).toMatchObject({
			pixelSize: 6,
			capStyle: 'square'
		});
	});

	it('allows decorative caps at 8:1 and above', async () => {
		const { qrState } = await import('./state.svelte');

		qrState.setPixelSize(8);
		qrState.setCapStyle('circle');

		expect(qrState.capStyle).toBe('circle');
		expect(JSON.parse(storage['qr-draft'])).toMatchObject({
			pixelSize: 8,
			capStyle: 'circle'
		});
	});

	it('allows one-third dot size at 6:1 where it still centers cleanly', async () => {
		const { qrState } = await import('./state.svelte');

		qrState.setPixelSize(6);
		qrState.setDotSize(1 / 3);

		expect(qrState.dotSize).toBeCloseTo(1 / 3);
		expect(JSON.parse(storage['qr-draft'])).toMatchObject({
			pixelSize: 6,
			dotSize: 1 / 3
		});
	});

	it('persists the selected connection mode', async () => {
		const { qrState } = await import('./state.svelte');

		qrState.setConnectionMode('disconnected');

		expect(qrState.connectionMode).toBe('disconnected');
		expect(JSON.parse(storage['qr-draft'])).toMatchObject({
			connectionMode: 'disconnected'
		});
	});

	it('clamps one-third dot size requests above 6:1 back to the ratio minimum', async () => {
		const { qrState } = await import('./state.svelte');

		qrState.setPixelSize(9);
		qrState.setDotSize(1 / 3);

		expect(qrState.dotSize).toBeCloseTo(5 / 9);
		expect(JSON.parse(storage['qr-draft'])).toMatchObject({
			pixelSize: 9,
			dotSize: 5 / 9
		});
	});

	it('can create isolated state instances backed by a custom draft store', async () => {
		const [{ createQrDraftStore }, { createQrState }] = await Promise.all([
			import('./persistence'),
			import('./state.svelte')
		]);

		const store = createQrDraftStore('qr-draft-secondary');
		const qrState = createQrState(store);

		qrState.setPayloadType('text');
		qrState.setPayloadField('text', 'text', 'hello from a custom store');

		expect(JSON.parse(storage['qr-draft-secondary'])).toMatchObject({
			payloadType: 'text',
			payloads: {
				text: { text: 'hello from a custom store' }
			}
		});
	});

	it('keeps in-memory edits working when persistent writes fail', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const [{ createQrDraftStore }, { createQrState }] = await Promise.all([
			import('./persistence'),
			import('./state.svelte')
		]);

		const store = createQrDraftStore('qr-draft-failing');
		vi.spyOn(store, 'set').mockImplementation(() => {
			throw new Error('quota exceeded');
		});

		const qrState = createQrState(store);

		expect(() => {
			qrState.setPayloadType('phone');
			qrState.setPayloadField('phone', 'number', '+31 6 9876 5432');
		}).not.toThrow();

		expect(qrState.payloadType).toBe('phone');
		expect(qrState.payloads.phone.number).toBe('+31 6 9876 5432');
		expect(storage['qr-draft-failing']).toBeUndefined();
		expect(warn).toHaveBeenCalledWith('Failed to persist QR draft', expect.any(Error));
	});
});
