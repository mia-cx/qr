<script lang="ts">
	import { themes, getTheme, getInitialThemeId, setTheme, getQrColors, themeStore, applyDocumentTheme } from '$lib/themes';
	import { qrState } from '$lib/qr/state.svelte';
	import Dropdown from './Dropdown.svelte';
	import { onMount } from 'svelte';

	let currentTheme = $state(getInitialThemeId());

	onMount(() => {
		const unsubscribe = themeStore.subscribe((id) => {
			currentTheme = id;
			applyDocumentTheme(id);
			const { fg, bg } = getQrColors();
			qrState.applyThemeColors(fg, bg);
		});
		return unsubscribe;
	});

	const themeItems = themes.map((t) => ({ value: t.id, label: t.name }));
</script>

<Dropdown
	items={themeItems}
	value={currentTheme}
	onselect={(id) => setTheme(id)}
	align="right"
	label="Theme"
>
	{#snippet trigger({ open, value })}
		<span class="flex items-center gap-1.5 px-2 py-1.5 bg-secondary border border-border text-foreground cursor-pointer text-xs leading-[1.5] w-[170px] transition-colors duration-200 hover:border-ring">
			<span class="size-2.5 shrink-0" style="background: {getTheme(value).accent}"></span>
			<span class="flex-1 font-medium whitespace-nowrap">{getTheme(value).name}</span>
			<svg class="shrink-0 text-muted-foreground transition-transform duration-150 {open ? 'rotate-180' : ''}" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 6l3 3 3-3" /></svg>
		</span>
	{/snippet}
	{#snippet children({ value, label, selected })}
		<span
			class="flex items-center gap-2 w-full h-full px-3 border-none text-sm text-left cursor-pointer transition-[opacity,filter] duration-150 hover:brightness-130 {selected ? 'font-semibold outline outline-1 outline-current -outline-offset-1' : ''}"
			style="background: {getTheme(value).bg}; color: {getTheme(value).fg};"
		>
			<span class="size-2 shrink-0" style="background: {getTheme(value).accent}"></span>
			{label}
		</span>
	{/snippet}
</Dropdown>
