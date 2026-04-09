<script lang="ts">
	import { qrState } from '$lib/qr/state.svelte';

	const labelCls = "flex items-center px-2.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap shrink-0 border-r border-border";
	const wrapCls = "flex items-stretch border border-border bg-secondary transition-colors duration-150 focus-within:border-ring";
	const inputCls = "w-full px-3 py-2.5 bg-transparent border-none text-foreground text-sm font-sans outline-none focus:border-transparent placeholder:text-muted-foreground";
</script>

<div class="flex flex-col gap-2">
	<div class="grid grid-cols-2 gap-2">
		<label class={wrapCls}>
			<span class={labelCls}>First</span>
			<input class={inputCls} type="text" aria-label="vCard first name" value={qrState.payloads.vcard.firstName} oninput={(e) => qrState.setPayloadField('vcard', 'firstName', e.currentTarget.value)} />
		</label>
		<label class={wrapCls}>
			<span class={labelCls}>Last</span>
			<input class={inputCls} type="text" aria-label="vCard last name" value={qrState.payloads.vcard.lastName} oninput={(e) => qrState.setPayloadField('vcard', 'lastName', e.currentTarget.value)} />
		</label>
	</div>
	<label class={wrapCls}>
		<span class={labelCls}>Phone</span>
		<input class={inputCls} type="tel" aria-label="vCard phone" value={qrState.payloads.vcard.phone} oninput={(e) => qrState.setPayloadField('vcard', 'phone', e.currentTarget.value)} />
	</label>
	<label class={wrapCls}>
		<span class={labelCls}>Email</span>
		<input class={inputCls} type="email" aria-label="vCard email" value={qrState.payloads.vcard.email} oninput={(e) => qrState.setPayloadField('vcard', 'email', e.currentTarget.value)} />
	</label>
	<label class={wrapCls}>
		<span class={labelCls}>Org</span>
		<input class={inputCls} type="text" aria-label="vCard organization" value={qrState.payloads.vcard.org} oninput={(e) => qrState.setPayloadField('vcard', 'org', e.currentTarget.value)} />
	</label>
	<label class={wrapCls}>
		<span class={labelCls}>Title</span>
		<input class={inputCls} type="text" aria-label="vCard title" value={qrState.payloads.vcard.title} oninput={(e) => qrState.setPayloadField('vcard', 'title', e.currentTarget.value)} />
	</label>
	<label class={wrapCls}>
		<span class={labelCls}>URL</span>
		<input class={inputCls} type="url" aria-label="vCard website" value={qrState.payloads.vcard.url} oninput={(e) => qrState.setPayloadField('vcard', 'url', e.currentTarget.value)} />
	</label>
	<label class={wrapCls}>
		<span class={labelCls}>Address</span>
		<input class={inputCls} type="text" aria-label="vCard address" value={qrState.payloads.vcard.address} oninput={(e) => qrState.setPayloadField('vcard', 'address', e.currentTarget.value)} />
	</label>
</div>
