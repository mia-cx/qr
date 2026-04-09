<script lang="ts">
	import { qrState } from '$lib/qr/state.svelte';

	const labelCls = "flex items-center px-2.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap shrink-0 border-r border-border";
	const wrapCls = "flex items-stretch border border-border bg-secondary transition-colors duration-150 focus-within:border-ring";
	const inputCls = "w-full px-3 py-2.5 bg-transparent border-none text-foreground text-sm font-sans outline-none focus:border-transparent placeholder:text-muted-foreground";
</script>

<div class="flex flex-col gap-2">
	<label class={wrapCls}>
		<span class={labelCls}>Name</span>
		<input class={inputCls} type="text" aria-label="MeCard name" value={qrState.payloads.mecard.name} oninput={(e) => qrState.setPayloadField('mecard', 'name', e.currentTarget.value)} />
	</label>
	<label class={wrapCls}>
		<span class={labelCls}>Phone</span>
		<input class={inputCls} type="tel" aria-label="MeCard phone" value={qrState.payloads.mecard.phone} oninput={(e) => qrState.setPayloadField('mecard', 'phone', e.currentTarget.value)} />
	</label>
	<label class={wrapCls}>
		<span class={labelCls}>Email</span>
		<input class={inputCls} type="email" aria-label="MeCard email" value={qrState.payloads.mecard.email} oninput={(e) => qrState.setPayloadField('mecard', 'email', e.currentTarget.value)} />
	</label>
	<label class={wrapCls}>
		<span class={labelCls}>URL</span>
		<input class={inputCls} type="url" aria-label="MeCard website" value={qrState.payloads.mecard.url} oninput={(e) => qrState.setPayloadField('mecard', 'url', e.currentTarget.value)} />
	</label>
	<label class={wrapCls}>
		<span class={labelCls}>Address</span>
		<input class={inputCls} type="text" aria-label="MeCard address" value={qrState.payloads.mecard.address} oninput={(e) => qrState.setPayloadField('mecard', 'address', e.currentTarget.value)} />
	</label>
	<label class={wrapCls}>
		<span class={labelCls}>Note</span>
		<textarea class="{inputCls} resize-y min-h-[60px]" aria-label="MeCard note" rows="2" value={qrState.payloads.mecard.note} oninput={(e) => qrState.setPayloadField('mecard', 'note', e.currentTarget.value)}></textarea>
	</label>
</div>
