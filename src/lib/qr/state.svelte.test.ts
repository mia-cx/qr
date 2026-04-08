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
