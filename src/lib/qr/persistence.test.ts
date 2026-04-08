import { setPersistentEngine } from '@nanostores/persistent';
import { beforeEach, describe, expect, it } from 'vitest';

import {
	createDefaultQrDraft,
	createQrDraftStore,
	normalizeQrDraft,
	QR_DRAFT_STORAGE_KEY
} from './persistence';

describe('QR draft persistence', () => {
	const storage: Record<string, string> = {};

	beforeEach(() => {
		for (const key of Object.keys(storage)) {
			delete storage[key];
		}

		setPersistentEngine(storage, {
			addEventListener() {},
			removeEventListener() {}
		});
	});

	it('loads a stored draft and restores the selected payload type and fields', () => {
		storage[QR_DRAFT_STORAGE_KEY] = JSON.stringify({
			payloadType: 'email',
			payloads: {
				email: {
					to: 'mia@example.com',
					subject: 'hello',
					body: 'saved draft'
				}
			},
			errorCorrection: 'H',
			pixelSize: 10,
			moduleStyle: 'square',
			fgColor: '#101010',
			bgColor: '#fafafa',
			frameText: 'scan me'
		});

		const snapshot = createQrDraftStore().get();

		expect(snapshot.payloadType).toBe('email');
		expect(snapshot.payloads.email).toEqual({
			to: 'mia@example.com',
			subject: 'hello',
			body: 'saved draft'
		});
		expect(snapshot.errorCorrection).toBe('H');
		expect(snapshot.pixelSize).toBe(10);
		expect(snapshot.frameText).toBe('scan me');
	});

	it('falls back to defaults when stored data is malformed', () => {
		const defaults = createDefaultQrDraft();

		expect(
			normalizeQrDraft({
				payloadType: 'not-real',
				payloads: { wifi: { hidden: 'nope' } },
				errorCorrection: 'X',
				pixelSize: -2,
				moduleStyle: 'triangle'
			})
		).toEqual(defaults);
	});

	it('writes the normalized snapshot back to storage', () => {
		const store = createQrDraftStore();

		store.set({
			...createDefaultQrDraft(),
			payloadType: 'phone',
			payloads: {
				...createDefaultQrDraft().payloads,
				phone: { number: '+31 6 1234 5678' }
			}
		});

		expect(JSON.parse(storage[QR_DRAFT_STORAGE_KEY])).toMatchObject({
			payloadType: 'phone',
			payloads: {
				phone: { number: '+31 6 1234 5678' }
			}
		});
	});
});
