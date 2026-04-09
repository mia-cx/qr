<script lang="ts">
	import { qrState } from '$lib/qr/state.svelte';
</script>

<div class="flex flex-col gap-2">
	<label class="flex items-stretch border border-border bg-secondary transition-colors duration-150 focus-within:border-ring">
		<span class="flex items-center px-2.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap shrink-0 border-r border-border">Phone</span>
		<input
			class="w-full px-3 py-2.5 bg-transparent border-none text-foreground text-sm font-sans outline-none focus:border-transparent placeholder:text-muted-foreground"
			type="tel"
			aria-label="SMS phone number"
			value={qrState.payloads.sms.number}
			oninput={(e) => qrState.setPayloadField('sms', 'number', e.currentTarget.value)}
		/>
	</label>
	<label class="flex items-stretch border border-border bg-secondary transition-colors duration-150 focus-within:border-ring">
		<span class="flex items-center px-2.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap shrink-0 border-r border-border">Message</span>
		<textarea
			class="w-full px-3 py-2.5 bg-transparent border-none text-foreground text-sm font-sans outline-none resize-y min-h-[60px] focus:border-transparent placeholder:text-muted-foreground"
			aria-label="SMS message"
			rows="2"
			value={qrState.payloads.sms.message}
			oninput={(e) => qrState.setPayloadField('sms', 'message', e.currentTarget.value)}
		></textarea>
	</label>
</div>
