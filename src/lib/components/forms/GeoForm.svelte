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
	<div class="grid grid-cols-2 gap-2">
		<label class={wrapCls}>
			<span class={labelCls}>Lat</span>
			<input
				class={inputCls}
				type="text"
				aria-label="Latitude"
				value={qrState.payloads.geo.latitude}
				oninput={(e) => qrState.setPayloadField('geo', 'latitude', e.currentTarget.value)}
			/>
		</label>
		<label class={wrapCls}>
			<span class={labelCls}>Lng</span>
			<input
				class={inputCls}
				type="text"
				aria-label="Longitude"
				value={qrState.payloads.geo.longitude}
				oninput={(e) => qrState.setPayloadField('geo', 'longitude', e.currentTarget.value)}
			/>
		</label>
	</div>
</div>
