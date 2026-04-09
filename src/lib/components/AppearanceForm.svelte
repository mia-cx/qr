<script lang="ts">
	import { qrState } from '$lib/qr/state.svelte';
	import {
		MIN_PIXEL_SIZE_FOR_CUSTOM_DOTS,
		MIN_PIXEL_SIZE_FOR_DECORATIVE_CAPS,
		MAX_DOT_SIZE,
		getMinimumPixelPerfectDotSize,
		getPixelPerfectDotSizeStep,
		isCapStyleAvailable,
		isConnectionModeConfigurable,
		isDotSizeConfigurable,
		type CapStyle,
		type ConnectionMode
	} from '$lib/qr/generate';
	import {
		SUGGESTED_PIXEL_SIZES,
		CAP_STYLE_VALUES,
		CAP_STYLE_LABELS,
		CONNECTION_MODE_VALUES,
		CONNECTION_MODE_LABELS
	} from '$lib/qr/constants';
	import { normalizeHexColor, getCornerShapePath, getConnectionModeDots, getConnectionModePath } from '$lib/qr/helpers';
	import Slider from '$lib/components/Slider.svelte';
	import { Tooltip, TooltipContent, TooltipTrigger } from '$lib/components/ui/tooltip';

	let pixelRatioInput = $state(String(qrState.pixelSize));
	let pixelRatioMenuOpen = $state(false);
	let pixelRatioActiveIndex = $state(-1);
	let pixelRatioInputEl = $state<HTMLInputElement | undefined>(undefined);
	let fgColorInput = $state(qrState.fgColor.toUpperCase());
	let bgColorInput = $state(qrState.bgColor.toUpperCase());
	let fgColorPicker = $state<HTMLInputElement | undefined>(undefined);
	let bgColorPicker = $state<HTMLInputElement | undefined>(undefined);

	const pixelSizeItems = SUGGESTED_PIXEL_SIZES.map((s) => ({ value: String(s), label: String(s) }));
	const pixelRatioMenuId = 'pixel-ratio-suggestions';
	const canAdjustDotSize = $derived(isDotSizeConfigurable(qrState.pixelSize));
	const dotSizeSliderMin = $derived(getMinimumPixelPerfectDotSize(qrState.pixelSize));
	const dotSizeSliderStep = $derived(getPixelPerfectDotSizeStep(qrState.pixelSize));
	const dotSizeAvailabilityHint = `Available at pixel ratio ${MIN_PIXEL_SIZE_FOR_CUSTOM_DOTS}:1 and above`;
	const capStyleAvailabilityHint = `Rounded and miter corner shapes are available at pixel ratio ${MIN_PIXEL_SIZE_FOR_DECORATIVE_CAPS}:1 and above`;
	const canConfigureConnections = $derived(
		isConnectionModeConfigurable(qrState.moduleStyle, qrState.capStyle, qrState.dotSize)
	);
	const connectionModeAvailabilityHint =
		'At 100% with square modules, dot union does not change the result.';

	$effect(() => { pixelRatioInput = String(qrState.pixelSize); });
	$effect(() => { fgColorInput = qrState.fgColor.toUpperCase(); });
	$effect(() => { bgColorInput = qrState.bgColor.toUpperCase(); });
	$effect(() => {
		if (pixelRatioActiveIndex >= pixelSizeItems.length) {
			pixelRatioActiveIndex = Math.max(pixelSizeItems.length - 1, -1);
		}
	});

	function openPixelRatioMenu() { pixelRatioMenuOpen = true; pixelRatioActiveIndex = -1; }
	function closePixelRatioMenu() { pixelRatioMenuOpen = false; pixelRatioActiveIndex = -1; }

	function commitPixelRatio(rawValue = pixelRatioInput) {
		const normalized = rawValue.replace(/\D+/g, '');
		if (!normalized) { pixelRatioInput = String(qrState.pixelSize); closePixelRatioMenu(); return; }
		const nextValue = Number.parseInt(normalized, 10);
		if (!Number.isFinite(nextValue) || nextValue < 1) { pixelRatioInput = String(qrState.pixelSize); closePixelRatioMenu(); return; }
		qrState.setPixelSize(nextValue);
		pixelRatioInput = String(qrState.pixelSize);
		closePixelRatioMenu();
	}

	function selectPixelRatio(value: string) { pixelRatioInput = value; commitPixelRatio(value); }
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
			pixelRatioInput = String(qrState.pixelSize);
			closePixelRatioMenu();
		}
	}

	function updateColorInput(kind: 'fg' | 'bg', value: string) {
		if (kind === 'fg') fgColorInput = value.toUpperCase();
		else bgColorInput = value.toUpperCase();
		const normalized = normalizeHexColor(value);
		if (!normalized) return;
		if (kind === 'fg') qrState.setFgColor(normalized);
		else qrState.setBgColor(normalized);
	}

	function commitColorInput(kind: 'fg' | 'bg') {
		const value = kind === 'fg' ? fgColorInput : bgColorInput;
		const fallback = kind === 'fg' ? qrState.fgColor : qrState.bgColor;
		const normalized = normalizeHexColor(value);
		const nextValue = normalized ?? fallback;
		if (kind === 'fg') { fgColorInput = nextValue.toUpperCase(); if (normalized) qrState.setFgColor(nextValue); }
		else { bgColorInput = nextValue.toUpperCase(); if (normalized) qrState.setBgColor(nextValue); }
	}

	function openColorPicker(kind: 'fg' | 'bg') {
		(kind === 'fg' ? fgColorPicker : bgColorPicker)?.click();
	}

	function isCapStyleDisabled(capStyle: CapStyle): boolean {
		return !isCapStyleAvailable(qrState.pixelSize, capStyle);
	}

	function moveRadioSelection<T extends string>(values: readonly T[], current: T, direction: 1 | -1) {
		const currentIndex = values.indexOf(current);
		return values[(currentIndex + direction + values.length) % values.length];
	}

	function handleCapStyleKeydown(e: KeyboardEvent, current: CapStyle) {
		if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
		e.preventDefault();
		const direction = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
		const available = CAP_STYLE_VALUES.filter((c) => isCapStyleAvailable(qrState.pixelSize, c));
		qrState.setCapStyle(moveRadioSelection(available, current, direction));
	}

	function handleConnectionModeKeydown(e: KeyboardEvent, current: ConnectionMode) {
		if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
		e.preventDefault();
		const direction = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
		qrState.setConnectionMode(moveRadioSelection(CONNECTION_MODE_VALUES, current, direction));
	}

	function handleWindowClick() {
		if (pixelRatioMenuOpen) pixelRatioMenuOpen = false;
	}

	const focusCls = "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2";
	const labelCls = "text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground leading-5";
	const radioCls = `flex-1 inline-flex items-center justify-center p-0 bg-secondary border-0 border-r border-border text-muted-foreground text-[0.8rem] font-medium cursor-pointer transition-colors duration-150 last:border-r-0 hover:text-foreground ${focusCls}`;
	const radioActiveCls = "!bg-accent !text-foreground !font-semibold";
</script>

<svelte:window onclick={handleWindowClick} />

<div class="flex-1 flex flex-col gap-3 min-h-0 overflow-x-hidden overflow-y-auto">
	<!-- Pixel Ratio + Dot Size -->
	<div class="flex items-end gap-3 min-w-0">
		<div class="flex flex-col gap-1 relative flex-[0_0_calc((100%-0.75rem)/3)] max-w-[calc((100%-0.75rem)/3)] min-w-0 max-sm:flex-[auto] max-sm:max-w-full">
			<span class={labelCls}>Pixel Ratio</span>
			<div class="flex items-center gap-1 w-full" onclick={(event) => event.stopPropagation()}>
				<div class="relative flex-1 min-w-0 z-30">
					<label class="sr-only" for="pixel-ratio-input">Pixel ratio</label>
					<div
						class="flex items-center gap-1.5 w-full h-8 px-2.5 bg-secondary border border-border text-foreground cursor-pointer text-[0.8rem] transition-colors duration-200 hover:border-ring focus-within:border-ring min-w-12 justify-end"
						onclick={() => { pixelRatioInputEl?.focus(); openPixelRatioMenu(); }}
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
						/>
					</div>
					{#if pixelRatioMenuOpen && pixelSizeItems.length}
						<div
							id={pixelRatioMenuId}
							class="absolute top-[calc(100%+0.25rem)] left-0 z-20 min-w-full bg-popover border border-border overflow-hidden shadow-[0_8px_24px_rgb(0_0_0/0.18)]"
							role="listbox"
							aria-label="Suggested pixel ratios"
							onpointerdown={(event) => { event.preventDefault(); event.stopPropagation(); }}
							onclick={(event) => event.stopPropagation()}
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
		</div>

		<div class="flex-1 min-w-0 relative flex flex-col gap-1">
			<div class="flex items-center gap-1.5">
				<span class={labelCls}>Dot Size</span>
				<Tooltip>
					<TooltipTrigger class="inline-flex items-center justify-center min-w-[1.55rem] h-5 px-0.5 border-none rounded-full bg-transparent text-muted-foreground text-[0.6rem] font-bold leading-none font-heading tracking-[0.14em] cursor-help transition-colors duration-150 hover:text-foreground hover:bg-accent/50 focus-visible:text-foreground focus-visible:bg-accent/50 focus-visible:outline-none" aria-label="Dot size guidance">[i]</TooltipTrigger>
					<TooltipContent side="top" sideOffset={6} class="max-w-72 px-3 py-2.5 text-[0.72rem] leading-[1.45]">
						Small dot sizes tend to scan better in dark-background themes. Readers struggle more with dark-on-light QR codes at small sizes, especially when the connected lines are enabled.
					</TooltipContent>
				</Tooltip>
			</div>
			{#key `${qrState.pixelSize}-${dotSizeSliderMin}-${dotSizeSliderStep}-${canAdjustDotSize ? 'enabled' : 'disabled'}`}
				{#if canAdjustDotSize}
					<Slider
						min={dotSizeSliderMin}
						max={MAX_DOT_SIZE}
						step={dotSizeSliderStep}
						value={qrState.dotSize}
						label="Dot size"
						formatValue={(v) => `${Math.round(v * 100)}%`}
						oninput={(v) => qrState.setDotSize(v)}
					/>
				{:else}
					<Tooltip>
						<TooltipTrigger>
							{#snippet child({ props })}
								<div {...props} class="w-full" aria-label={dotSizeAvailabilityHint}>
									<Slider
										min={dotSizeSliderMin}
										max={MAX_DOT_SIZE}
										step={dotSizeSliderStep}
										value={qrState.dotSize}
										label="Dot size"
										disabled
										formatValue={(v) => `${Math.round(v * 100)}%`}
										oninput={() => {}}
									/>
								</div>
							{/snippet}
						</TooltipTrigger>
						<TooltipContent side="top" sideOffset={6} class="max-w-56 px-2.5 py-2 text-[0.68rem] leading-[1.35]">{dotSizeAvailabilityHint}</TooltipContent>
					</Tooltip>
				{/if}
			{/key}
		</div>
	</div>

	<!-- Corner Shape + Dot Union -->
	<div class="flex items-end gap-3 min-w-0 max-sm:flex-col max-sm:gap-3">
		<div class="flex-1 min-w-0 relative flex flex-col gap-1">
			<span class={labelCls}>Corner Shape</span>
			<div class="flex gap-0 h-8 border border-border" role="radiogroup" aria-label="Corner shape">
				{#each CAP_STYLE_VALUES as cap (cap)}
					{#if isCapStyleDisabled(cap)}
						<Tooltip>
							<TooltipTrigger>
								{#snippet child({ props })}
									<div {...props} class="flex flex-1 border-r border-border cursor-not-allowed last:border-r-0" aria-label={capStyleAvailabilityHint}>
										<button type="button" class="{radioCls} w-full !border-r-0 disabled:cursor-not-allowed disabled:opacity-45" role="radio" aria-checked={qrState.capStyle === cap} aria-label={CAP_STYLE_LABELS[cap]} aria-disabled="true" disabled>
											<svg class="size-4 overflow-visible" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d={getCornerShapePath(cap)} /></svg>
										</button>
									</div>
								{/snippet}
							</TooltipTrigger>
							<TooltipContent side="top" sideOffset={6} class="max-w-56 px-2.5 py-2 text-[0.68rem] leading-[1.35]">{capStyleAvailabilityHint}</TooltipContent>
						</Tooltip>
					{:else}
						<button
							type="button"
							class="{radioCls} {qrState.capStyle === cap ? radioActiveCls : ''}"
							role="radio"
							aria-checked={qrState.capStyle === cap}
							aria-label={CAP_STYLE_LABELS[cap]}
							onkeydown={(e) => handleCapStyleKeydown(e, cap)}
							onclick={() => qrState.setCapStyle(cap)}
						>
							<svg class="size-4 overflow-visible" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d={getCornerShapePath(cap)} /></svg>
						</button>
					{/if}
				{/each}
			</div>
		</div>

		<div class="flex-1 min-w-0 relative flex flex-col gap-1">
			<span class={labelCls}>Dot Union</span>
			{#if canConfigureConnections}
				<div class="flex gap-0 h-8 border border-border" role="radiogroup" aria-label="Dot union">
					{#each CONNECTION_MODE_VALUES as mode (mode)}
						<button
							type="button"
							class="{radioCls} {qrState.connectionMode === mode ? radioActiveCls : ''}"
							role="radio"
							aria-checked={qrState.connectionMode === mode}
							aria-label={CONNECTION_MODE_LABELS[mode]}
							onkeydown={(e) => handleConnectionModeKeydown(e, mode)}
							onclick={() => qrState.setConnectionMode(mode)}
						>
							<svg class="size-4 block overflow-visible" viewBox="0 0 16 16" aria-hidden="true">
								{#if getConnectionModePath(mode)}
									<path d={getConnectionModePath(mode)} fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
								{/if}
								{#each getConnectionModeDots(mode) as dot (`${mode}-${dot.cx}-${dot.cy}`)}
									<circle cx={dot.cx} cy={dot.cy} r="1.35" fill="currentColor" />
								{/each}
							</svg>
						</button>
					{/each}
				</div>
			{:else}
				<Tooltip>
					<TooltipTrigger>
						{#snippet child({ props })}
							<div {...props} class="flex w-full cursor-not-allowed" aria-label={connectionModeAvailabilityHint}>
								<div class="flex gap-0 h-8 border border-border w-full" role="radiogroup" aria-label="Dot union">
									{#each CONNECTION_MODE_VALUES as mode (mode)}
										<button type="button" class="{radioCls} {qrState.connectionMode === mode ? radioActiveCls : ''} disabled:cursor-not-allowed disabled:opacity-45" role="radio" aria-checked={qrState.connectionMode === mode} aria-label={CONNECTION_MODE_LABELS[mode]} aria-disabled="true" disabled>
											<svg class="size-4 block overflow-visible" viewBox="0 0 16 16" aria-hidden="true">
												{#if getConnectionModePath(mode)}
													<path d={getConnectionModePath(mode)} fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
												{/if}
												{#each getConnectionModeDots(mode) as dot (`${mode}-${dot.cx}-${dot.cy}`)}
													<circle cx={dot.cx} cy={dot.cy} r="1.35" fill="currentColor" />
												{/each}
											</svg>
										</button>
									{/each}
								</div>
							</div>
						{/snippet}
					</TooltipTrigger>
					<TooltipContent side="top" sideOffset={6} class="max-w-56 px-2.5 py-2 text-[0.68rem] leading-[1.35]">{connectionModeAvailabilityHint}</TooltipContent>
				</Tooltip>
			{/if}
		</div>
	</div>

	<!-- Foreground + Background colors -->
	<div class="flex items-end gap-3 min-w-0 max-sm:flex-col max-sm:gap-3">
		<div class="flex-1 min-w-0 relative flex flex-col gap-1">
			<span class={labelCls}>Foreground</span>
			<div class="flex items-center gap-2 h-8 px-2.5 bg-secondary border border-border transition-colors duration-200 hover:border-ring focus-within:border-ring" role="group" aria-label="Foreground color">
				<button type="button" class="inline-flex items-center justify-center size-7 p-0 border-none bg-transparent cursor-pointer shrink-0 {focusCls}" aria-label="Open foreground color picker" onclick={() => openColorPicker('fg')}>
					<span class="size-5 border border-border block" style={`background: ${qrState.fgColor}`}></span>
				</button>
				<input
					bind:this={fgColorPicker}
					type="color"
					class="sr-only"
					tabindex="-1"
					aria-hidden="true"
					value={qrState.fgColor}
					oninput={(e) => updateColorInput('fg', e.currentTarget.value)}
				/>
				<input
					type="text"
					class="flex-1 min-w-0 p-0 bg-transparent border-none text-foreground text-xs font-medium font-sans uppercase outline-none placeholder:text-muted-foreground"
					inputmode="text"
					spellcheck="false"
					autocapitalize="characters"
					autocomplete="off"
					maxlength="7"
					aria-label="Foreground hex color"
					value={fgColorInput}
					oninput={(e) => updateColorInput('fg', e.currentTarget.value)}
					onblur={() => commitColorInput('fg')}
					onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitColorInput('fg'); } }}
				/>
			</div>
		</div>
		<div class="flex-1 min-w-0 relative flex flex-col gap-1">
			<span class={labelCls}>Background</span>
			<div class="flex items-center gap-2 h-8 px-2.5 bg-secondary border border-border transition-colors duration-200 hover:border-ring focus-within:border-ring" role="group" aria-label="Background color">
				<button type="button" class="inline-flex items-center justify-center size-7 p-0 border-none bg-transparent cursor-pointer shrink-0 {focusCls}" aria-label="Open background color picker" onclick={() => openColorPicker('bg')}>
					<span class="size-5 border border-border block" style={`background: ${qrState.bgColor}`}></span>
				</button>
				<input
					bind:this={bgColorPicker}
					type="color"
					class="sr-only"
					tabindex="-1"
					aria-hidden="true"
					value={qrState.bgColor}
					oninput={(e) => updateColorInput('bg', e.currentTarget.value)}
				/>
				<input
					type="text"
					class="flex-1 min-w-0 p-0 bg-transparent border-none text-foreground text-xs font-medium font-sans uppercase outline-none placeholder:text-muted-foreground"
					inputmode="text"
					spellcheck="false"
					autocapitalize="characters"
					autocomplete="off"
					maxlength="7"
					aria-label="Background hex color"
					value={bgColorInput}
					oninput={(e) => updateColorInput('bg', e.currentTarget.value)}
					onblur={() => commitColorInput('bg')}
					onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitColorInput('bg'); } }}
				/>
			</div>
		</div>
	</div>
</div>
