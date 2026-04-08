<script lang="ts">
	import DateRangePicker from './DateRangePicker.svelte';

	let start = $state('2026-04-01T09:00');
	let end = $state('2026-04-02T10:00');

	function updateProps() {
		start = '2026-04-03T12:30';
		end = '2026-04-04T14:45';
	}
</script>

<button type="button" data-testid="update-props" onclick={updateProps}>Update props</button>

<DateRangePicker
	{start}
	{end}
	onchange={(nextStart, nextEnd) => {
		start = nextStart;
		end = nextEnd;
	}}
/>
