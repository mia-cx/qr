<script lang="ts">
	import { qrState } from '$lib/qr/state.svelte';
	import { getPrimaryPlaceholder, getPrimaryLabel } from '$lib/qr/helpers';
	import { AUTO_DETECT_PATTERNS, SIMPLE_PAYLOAD_TYPES } from '$lib/qr/constants';
	import type { PayloadType } from '$lib/qr/payloads';

	function getPrimaryValue(): string {
		const t = qrState.payloadType;
		if (t === 'url') return qrState.payloads.url.url;
		if (t === 'text') return qrState.payloads.text.text;
		if (t === 'phone') return qrState.payloads.phone.number;
		return '';
	}

	function updatePrimaryField(value: string) {
		const t = qrState.payloadType;
		if (t === 'url') qrState.setPayloadField('url', 'url', value);
		else if (t === 'text') qrState.setPayloadField('text', 'text', value);
		else if (t === 'phone') qrState.setPayloadField('phone', 'number', value);
	}

	function handlePrimaryInput(value: string) {
		const currentType = qrState.payloadType;
		if (!(SIMPLE_PAYLOAD_TYPES as readonly string[]).includes(currentType)) {
			updatePrimaryField(value);
			return;
		}

		let targetType: PayloadType;
		if (AUTO_DETECT_PATTERNS.url.test(value) && !AUTO_DETECT_PATTERNS.whitespace.test(value)) {
			targetType = 'url';
		} else if (AUTO_DETECT_PATTERNS.phone.test(value) && value.replace(/\D/g, '').length >= 7) {
			targetType = 'phone';
		} else {
			targetType = 'text';
		}

		qrState.setAutoDetectedPrimaryValue(targetType, value);
	}
</script>

<div class="flex flex-1 flex-col gap-1 min-h-0">
	<textarea
		class="flex-1 resize-none min-h-0 w-full px-3 py-2.5 bg-secondary border border-border text-foreground text-sm font-sans outline-none transition-colors duration-150 focus:border-ring placeholder:text-muted-foreground"
		aria-label={getPrimaryLabel(qrState.payloadType)}
		placeholder={getPrimaryPlaceholder(qrState.payloadType)}
		value={getPrimaryValue()}
		oninput={(e) => handlePrimaryInput(e.currentTarget.value)}
	></textarea>
</div>
