<script lang="ts">
	import { qrState } from '$lib/qr/state.svelte';

	const labelCls =
		'flex items-center px-2.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap shrink-0 border-r border-border';
	const wrapCls =
		'flex items-stretch border border-border bg-secondary transition-colors duration-150 focus-within:border-ring';
	const inputCls =
		'w-full px-3 py-2.5 bg-transparent border-none text-foreground text-sm font-sans outline-none focus:border-transparent placeholder:text-muted-foreground';
</script>

<div class="flex flex-col gap-2">
	<label class={wrapCls}>
		<span class={labelCls}>Email</span>
		<input
			class={inputCls}
			type="email"
			aria-label="Recipient email"
			value={qrState.payloads.email.to}
			oninput={(e) => qrState.setPayloadField('email', 'to', e.currentTarget.value)}
		/>
	</label>
	<label class={wrapCls}>
		<span class={labelCls}>Subject</span>
		<input
			class={inputCls}
			type="text"
			aria-label="Email subject"
			value={qrState.payloads.email.subject}
			oninput={(e) => qrState.setPayloadField('email', 'subject', e.currentTarget.value)}
		/>
	</label>
	<label class={wrapCls}>
		<span class={labelCls}>Body</span>
		<textarea
			class="{inputCls} min-h-[60px] resize-y"
			aria-label="Email body"
			rows="2"
			value={qrState.payloads.email.body}
			oninput={(e) => qrState.setPayloadField('email', 'body', e.currentTarget.value)}
		></textarea>
	</label>
</div>
