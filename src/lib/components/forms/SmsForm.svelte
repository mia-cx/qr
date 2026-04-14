<script lang="ts">
	import { qrState } from '$lib/qr/state.svelte';
</script>

<div class="flex flex-col gap-2">
	<label
		class="flex items-stretch border border-border bg-secondary transition-colors duration-150 focus-within:border-ring"
	>
		<span
			class="flex shrink-0 items-center border-r border-border px-2.5 text-[0.65rem] font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase"
			>Phone</span
		>
		<input
			class="w-full border-none bg-transparent px-3 py-2.5 font-sans text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-transparent"
			type="tel"
			aria-label="SMS phone number"
			value={qrState.payloads.sms.number}
			oninput={(e) => qrState.setPayloadField('sms', 'number', e.currentTarget.value)}
		/>
	</label>
	<label
		class="flex items-stretch border border-border bg-secondary transition-colors duration-150 focus-within:border-ring"
	>
		<span
			class="flex shrink-0 items-center border-r border-border px-2.5 text-[0.65rem] font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase"
			>Message</span
		>
		<textarea
			class="min-h-[60px] w-full resize-y border-none bg-transparent px-3 py-2.5 font-sans text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-transparent"
			aria-label="SMS message"
			rows="2"
			value={qrState.payloads.sms.message}
			oninput={(e) => qrState.setPayloadField('sms', 'message', e.currentTarget.value)}
		></textarea>
	</label>
</div>
