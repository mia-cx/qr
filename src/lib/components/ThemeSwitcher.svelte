<script lang="ts">
	import * as Select from '$lib/components/ui/select';
	import {
		themes,
		getTheme,
		getInitialThemeId,
		setTheme,
		getQrColors,
		themeStore,
		applyDocumentTheme
	} from '$lib/themes';
	import { qrState } from '$lib/qr/state.svelte';
	import { onMount } from 'svelte';

	let currentTheme = $state(getInitialThemeId());
	let themeMenuOpen = $state(false);

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

<Select.Root
	type="single"
	bind:open={themeMenuOpen}
	value={currentTheme}
	onValueChange={(value: string) => setTheme(value)}
>
	<Select.Trigger class="h-auto w-[170px] px-2 py-1.5 text-xs leading-[1.5] hover:border-ring">
		<span class="flex items-center gap-1.5">
			<span class="size-2.5 shrink-0" style={`background: ${getTheme(currentTheme).accent}`}></span>
			<span class="flex-1 font-medium whitespace-nowrap">{getTheme(currentTheme).name}</span>
		</span>
	</Select.Trigger>
	<Select.Content align="end" sideOffset={0}>
		{#each themeItems as item (item.value)}
			<Select.Item value={item.value} label={item.label} class="h-9">
				{#snippet children({ selected })}
					<span
						class={`flex h-full w-full items-center gap-2 px-3 text-left text-sm transition-[opacity,filter] duration-150 hover:brightness-130 ${selected ? 'font-semibold outline outline-1 -outline-offset-1 outline-current' : ''}`}
						style={`background: ${getTheme(item.value).bg}; color: ${getTheme(item.value).fg};`}
					>
						<span class="size-2 shrink-0" style={`background: ${getTheme(item.value).accent}`}
						></span>
						{item.label}
					</span>
				{/snippet}
			</Select.Item>
		{/each}
	</Select.Content>
</Select.Root>
