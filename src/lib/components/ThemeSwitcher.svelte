<script lang="ts">
	import { themes, getTheme, getInitialThemeId, setTheme, getQrColors, themeStore, applyDocumentTheme } from '$lib/themes';
	import { qrState } from '$lib/qr/state.svelte';
	import { Select, SelectTrigger, SelectContent, SelectItem } from '$lib/components/ui/select';
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
</script>

<Select
	type="single"
	value={currentTheme}
	onValueChange={(id) => { if (id) setTheme(id); }}
>
	<SelectTrigger aria-label="Theme" class="w-[170px] px-2 py-1.5 text-xs leading-[1.5]">
		<span class="size-2.5 shrink-0" style="background: {getTheme(currentTheme).accent}"></span>
		<span class="flex-1 font-medium whitespace-nowrap">{getTheme(currentTheme).name}</span>
	</SelectTrigger>
	<SelectContent>
		{#each themes as theme (theme.id)}
			<SelectItem value={theme.id} class="px-0 py-0 h-9">
				{#snippet children({ selected })}
					<span class="absolute end-2 flex size-3.5 items-center justify-center"></span>
					<span
						class="flex items-center gap-2 w-full h-full px-3 text-sm cursor-pointer transition-[opacity,filter] duration-150 hover:brightness-130 {selected ? 'font-semibold outline outline-1 outline-current -outline-offset-1' : ''}"
						style="background: {theme.bg}; color: {theme.fg};"
					>
						<span class="size-2 shrink-0" style="background: {theme.accent}"></span>
						{theme.name}
					</span>
				{/snippet}
			</SelectItem>
		{/each}
	</SelectContent>
</Select>
