<script lang="ts">
	import { qrState } from '$lib/qr/state.svelte';
	import SimplePayloadForm from './forms/SimplePayloadForm.svelte';
	import WifiForm from './forms/WifiForm.svelte';
	import SmsForm from './forms/SmsForm.svelte';
	import EmailForm from './forms/EmailForm.svelte';
	import VCardForm from './forms/VCardForm.svelte';
	import MeCardForm from './forms/MeCardForm.svelte';
	import CalendarForm from './forms/CalendarForm.svelte';
	import GeoForm from './forms/GeoForm.svelte';
	import { SIMPLE_PAYLOAD_TYPES } from '$lib/qr/constants';

	const isSimpleType = $derived(
		(SIMPLE_PAYLOAD_TYPES as readonly string[]).includes(qrState.payloadType)
	);
</script>

{#if isSimpleType}
	<SimplePayloadForm />
{:else if qrState.payloadType === 'wifi'}
	<WifiForm />
{:else if qrState.payloadType === 'sms'}
	<SmsForm />
{:else if qrState.payloadType === 'email'}
	<EmailForm />
{:else if qrState.payloadType === 'vcard'}
	<VCardForm />
{:else if qrState.payloadType === 'mecard'}
	<MeCardForm />
{:else if qrState.payloadType === 'calendar'}
	<CalendarForm />
{:else if qrState.payloadType === 'geo'}
	<GeoForm />
{/if}
