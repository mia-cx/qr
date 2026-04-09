<script lang="ts">
	import { SUGGESTED_PIXEL_SIZES } from '$lib/qr/constants';

	interface Props {
		value: number;
		oninput: (v: number) => void;
	}

	let { value, oninput }: Props = $props();

	let pixelRatioInput = $state('');
	let pixelRatioMenuOpen = $state(false);
	let pixelRatioActiveIndex = $state(-1);
	let pixelRatioInputEl = $state<HTMLInputElement | undefined>(undefined);

	const pixelSizeItems = SUGGESTED_PIXEL_SIZES.map((s) => ({ value: String(s), label: String(s) }));
	const pixelRatioMenuId = 'pixel-ratio-suggestions';

	$effect(() => { pixelRatioInput = String(value); });
	$effect(() => {
		if (pixelRatioActiveIndex >= pixelSizeItems.length) {
			pixelRatioActiveIndex = Math.max(pixelSizeItems.length - 1, -1);
		}
	});

	function openPixelRatioMenu() { pixelRatioMenuOpen = true; pixelRatioActiveIndex = -1; }
	function closePixelRatioMenu() { pixelRatioMenuOpen = false; pixelRatioActiveIndex = -1; }

	function commitPixelRatio(rawValue = pixelRatioInput) {
		const normalized = rawValue.replace(/\D+/g, '');
		if (!normalized) { pixelRatioInput = String(value); closePixelRatioMenu(); return; }
		const nextValue = Number.parseInt(normalized, 10);
		if (!Number.isFinite(nextValue) || nextValue < 1) { pixelRatioInput = String(value); closePixelRatioMenu(); return; }
		oninput(nextValue);
		pixelRatioInput = String(nextValue);
		closePixelRatioMenu();
	}

	function selectPixelRatio(v: string) { pixelRatioInput = v; commitPixelRatio(v); }

	function handlePixelRatioInput(event: Event) {
		pixelRatioInput = (event.currentTarget as HTMLInputElement).value.replace(/\D+/g, '');
		pixelRatioMenuOpen = true;
		pixelRatioActiveIndex = -1;
	}

	function handlePixelRatioKeydown(event: KeyboardEvent) {
		const items = pixelSizeItems;
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			pixelRatioMenuOpen = true;
			pixelRatioActiveIndex = pixelRatioActiveIndex < 0 ? 0 : (pixelRatioActiveIndex + 1) % items.length;
			return;
		}
		if (event.key === 'ArrowUp') {
			event.preventDefault();
			pixelRatioMenuOpen = true;
			pixelRatioActiveIndex = pixelRatioActiveIndex < 0 ? items.length - 1 : (pixelRatioActiveIndex - 1 + items.length) % items.length;
			return;
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			if (pixelRatioMenuOpen && pixelRatioActiveIndex >= 0 && items.length) {
				commitPixelRatio(items[pixelRatioActiveIndex]?.value ?? pixelRatioInput);
				return;
			}
			commitPixelRatio();
			return;
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			pixelRatioInput = String(value);
			closePixelRatioMenu();
		}
	}

	function handleWindowClick() {
		if (pixelRatioMenuOpen) pixelRatioMenuOpen = false;
	}
</script>

<svelte:window onclick={handleWindowClick} />

<div class="flex items-center gap-1 w-full">
	<div class="relative flex-1 min-w-0 z-30">
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="flex items-center gap-1.5 w-full h-8 px-2.5 bg-secondary border border-border text-foreground cursor-pointer text-[0.8rem] transition-colors duration-200 hover:border-ring focus-within:border-ring min-w-12 justify-end"
			onclick={(event) => { event.stopPropagation(); pixelRatioInputEl?.focus(); openPixelRatioMenu(); }}
			onkeydown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.stopPropagation(); pixelRatioInputEl?.focus(); openPixelRatioMenu(); } }}
		>
			<input
				id="pixel-ratio-input"
				bind:this={pixelRatioInputEl}
				type="number"
				min="1"
				inputmode="numeric"
				pattern="[0-9]*"
				class="w-full min-w-0 p-0 bg-transparent border-none text-foreground font-inherit font-medium text-right appearance-textfield outline-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
				role="combobox"
				aria-label="Pixel ratio"
				aria-expanded={pixelRatioMenuOpen}
				aria-controls={pixelRatioMenuId}
				aria-activedescendant={pixelRatioMenuOpen && pixelRatioActiveIndex >= 0 && pixelSizeItems[pixelRatioActiveIndex]
					? `${pixelRatioMenuId}-${pixelSizeItems[pixelRatioActiveIndex].value}` : undefined}
				autocomplete="off"
				value={pixelRatioInput}
				onfocus={openPixelRatioMenu}
				oninput={handlePixelRatioInput}
				onkeydown={handlePixelRatioKeydown}
				onblur={() => commitPixelRatio()}
				onclick={(event) => event.stopPropagation()}
			/>
		</div>
		{#if pixelRatioMenuOpen && pixelSizeItems.length}
			<div
				id={pixelRatioMenuId}
				class="absolute top-[calc(100%+0.25rem)] left-0 z-20 min-w-full bg-popover border border-border overflow-hidden shadow-[0_8px_24px_rgb(0_0_0/0.18)]"
				role="listbox"
				aria-label="Suggested pixel ratios"
				tabindex="-1"
				onpointerdown={(event) => { event.preventDefault(); event.stopPropagation(); }}
				onclick={(event) => event.stopPropagation()}
				onkeydown={(event) => event.stopPropagation()}
			>
				{#each pixelSizeItems as item, index (item.value)}
					<button
						type="button"
						id={`${pixelRatioMenuId}-${item.value}`}
						class="block w-full p-0 bg-transparent border-none text-foreground cursor-pointer text-inherit hover:bg-accent {index === pixelRatioActiveIndex ? 'bg-accent' : ''}"
						role="option"
						aria-selected={index === pixelRatioActiveIndex}
						onmouseenter={() => { pixelRatioActiveIndex = index; }}
						onpointerdown={(event) => { event.preventDefault(); event.stopPropagation(); }}
						onclick={(event) => { event.stopPropagation(); selectPixelRatio(item.value); }}
					>
						<span class="flex items-center justify-end w-full h-full px-3 text-right">{item.label}</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>
	<span class="text-[0.8rem] font-medium text-muted-foreground">&nbsp;:&nbsp;1</span>
</div>
