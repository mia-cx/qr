<script lang="ts">
	import { qrState } from '$lib/qr/state.svelte';
	import DateRangePicker from '$lib/components/DateRangePicker.svelte';

	const labelCls =
		'flex items-center px-2.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap shrink-0 border-r border-border';
	const wrapCls =
		'flex items-stretch border border-border bg-secondary transition-colors duration-150 focus-within:border-ring';
	const inputCls =
		'w-full px-3 py-2.5 bg-transparent border-none text-foreground text-sm font-sans outline-none focus:border-transparent placeholder:text-muted-foreground';
</script>

<div class="flex flex-col gap-2">
	<label class={wrapCls}>
		<span class={labelCls}>Title</span>
		<input
			class={inputCls}
			type="text"
			aria-label="Calendar event title"
			value={qrState.payloads.calendar.title}
			oninput={(e) => qrState.setPayloadField('calendar', 'title', e.currentTarget.value)}
		/>
	</label>
	<label class={wrapCls}>
		<span class={labelCls}>Location</span>
		<input
			class={inputCls}
			type="text"
			aria-label="Calendar location"
			value={qrState.payloads.calendar.location}
			oninput={(e) => qrState.setPayloadField('calendar', 'location', e.currentTarget.value)}
		/>
	</label>
	<label class={wrapCls}>
		<span class={labelCls}>Details</span>
		<textarea
			class="{inputCls} min-h-[60px] resize-y"
			aria-label="Calendar description"
			rows="2"
			value={qrState.payloads.calendar.description}
			oninput={(e) => qrState.setPayloadField('calendar', 'description', e.currentTarget.value)}
		></textarea>
	</label>
	<DateRangePicker
		label="Calendar event date and time range"
		start={qrState.payloads.calendar.start}
		end={qrState.payloads.calendar.end}
		onchange={(s, e) => {
			qrState.setPayloadField('calendar', 'start', s);
			qrState.setPayloadField('calendar', 'end', e);
		}}
	/>
</div>
