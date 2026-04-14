<script lang="ts">
	interface Props {
		value: number;
		suggestions: string[];
		oninput: (value: number) => void;
	}

	let { value, suggestions, oninput }: Props = $props();

	let textValue = $state('');
	let menuOpen = $state(false);
	let activeIndex = $state(-1);
	let rootEl = $state<HTMLDivElement | undefined>(undefined);

	const inputId = 'pixel-ratio-input';
	const menuId = 'pixel-ratio-suggestions';
	const labelCls =
		'text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground leading-5';

	$effect(() => {
		textValue = String(value);
	});

	$effect(() => {
		if (activeIndex >= suggestions.length) {
			activeIndex = Math.max(suggestions.length - 1, -1);
		}
	});

	function openMenu() {
		menuOpen = true;
		activeIndex = -1;
	}

	function closeMenu() {
		menuOpen = false;
		activeIndex = -1;
	}

	function commit(nextRaw = textValue) {
		const normalized = nextRaw.replace(/\D+/g, '');
		if (!normalized) {
			textValue = String(value);
			closeMenu();
			return;
		}

		const nextValue = Number.parseInt(normalized, 10);
		if (!Number.isFinite(nextValue) || nextValue < 1) {
			textValue = String(value);
			closeMenu();
			return;
		}

		oninput(nextValue);
		textValue = String(nextValue);
		closeMenu();
	}

	function selectSuggestion(nextValue: string) {
		textValue = nextValue;
		commit(nextValue);
	}

	function handleInput(event: Event) {
		textValue = (event.currentTarget as HTMLInputElement).value.replace(/\D+/g, '');
		menuOpen = true;
		activeIndex = -1;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			menuOpen = true;
			activeIndex = activeIndex < 0 ? 0 : (activeIndex + 1) % suggestions.length;
			return;
		}

		if (event.key === 'ArrowUp') {
			event.preventDefault();
			menuOpen = true;
			activeIndex =
				activeIndex < 0
					? suggestions.length - 1
					: (activeIndex - 1 + suggestions.length) % suggestions.length;
			return;
		}

		if (event.key === 'Enter') {
			event.preventDefault();
			if (menuOpen && activeIndex >= 0 && suggestions.length) {
				commit(suggestions[activeIndex] ?? textValue);
				return;
			}
			commit();
			return;
		}

		if (event.key === 'Escape') {
			event.preventDefault();
			textValue = String(value);
			closeMenu();
		}
	}
</script>

<svelte:window
	onpointerdown={(event) => {
		if (rootEl && event.target instanceof Node && rootEl.contains(event.target)) {
			return;
		}

		closeMenu();
	}}
/>

<div
	bind:this={rootEl}
	class="relative flex max-w-[calc((100%-0.75rem)/3)] min-w-0 flex-[0_0_calc((100%-0.75rem)/3)] flex-col gap-1 max-sm:max-w-full max-sm:flex-[auto]"
>
	<span class={labelCls}>Pixel Ratio</span>
	<div class="flex items-center gap-1">
		<div class="relative z-30 min-w-0 flex-1">
			<label class="sr-only" for={inputId}>Pixel ratio</label>
			<input
				id={inputId}
				type="number"
				min="1"
				inputmode="numeric"
				pattern="[0-9]*"
				class="h-8 w-full min-w-12 border border-border bg-secondary px-2.5 text-right text-[0.8rem] font-medium text-foreground transition-colors duration-200 outline-none hover:border-ring focus:border-ring [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
				role="combobox"
				aria-label="Pixel ratio"
				aria-expanded={menuOpen}
				aria-controls={menuId}
				aria-activedescendant={menuOpen && activeIndex >= 0 && suggestions[activeIndex]
					? `${menuId}-${suggestions[activeIndex]}`
					: undefined}
				autocomplete="off"
				value={textValue}
				onfocus={openMenu}
				oninput={handleInput}
				onkeydown={handleKeydown}
				onblur={() => commit()}
			/>
			{#if menuOpen && suggestions.length}
				<div
					id={menuId}
					tabindex="-1"
					class="absolute top-[calc(100%+0.25rem)] left-0 z-20 min-w-full overflow-hidden border border-border bg-popover shadow-[0_8px_24px_rgb(0_0_0/0.18)]"
					role="listbox"
					aria-label="Suggested pixel ratios"
				>
					{#each suggestions as suggestion, index (suggestion)}
						<button
							type="button"
							id={`${menuId}-${suggestion}`}
							class={`block w-full bg-transparent p-0 text-foreground text-inherit hover:bg-accent ${index === activeIndex ? 'bg-accent' : ''}`}
							role="option"
							aria-selected={index === activeIndex}
							onmouseenter={() => {
								activeIndex = index;
							}}
							onpointerdown={(event) => {
								event.preventDefault();
							}}
							onclick={() => selectSuggestion(suggestion)}
						>
							<span class="flex h-full w-full items-center justify-end px-3 text-right"
								>{suggestion}</span
							>
						</button>
					{/each}
				</div>
			{/if}
		</div>
		<span class="text-[0.8rem] font-medium text-muted-foreground">&nbsp;:&nbsp;1</span>
	</div>
</div>
