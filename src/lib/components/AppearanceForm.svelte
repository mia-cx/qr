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
	import {
		getCornerShapePath,
		getConnectionModeDots,
		getConnectionModePath
	} from '$lib/qr/helpers';
	import ColorInput from '$lib/components/ColorInput.svelte';
	import PixelRatioInput from '$lib/components/PixelRatioInput.svelte';
	import Slider from '$lib/components/Slider.svelte';
	import { Tooltip, TooltipContent, TooltipTrigger } from '$lib/components/ui/tooltip';
	import { focusCls, moveRadioSelection } from '$lib/utils';

	const pixelSizeSuggestions = SUGGESTED_PIXEL_SIZES.map((size) => String(size));
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

	function isCapStyleDisabled(capStyle: CapStyle): boolean {
		return !isCapStyleAvailable(qrState.pixelSize, capStyle);
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

	const labelCls =
		'text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground leading-5';
	const radioCls = `flex-1 inline-flex items-center justify-center p-0 bg-secondary border-0 border-r border-border text-muted-foreground text-[0.8rem] font-medium cursor-pointer transition-colors duration-150 last:border-r-0 hover:text-foreground ${focusCls}`;
	const radioActiveCls = '!bg-accent !text-foreground !font-semibold';
</script>

<div class="flex min-h-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto">
	<!-- Pixel Ratio + Dot Size -->
	<div class="flex min-w-0 items-end gap-3">
		<PixelRatioInput
			value={qrState.pixelSize}
			suggestions={pixelSizeSuggestions}
			oninput={(value) => qrState.setPixelSize(value)}
		/>

		<div class="relative flex min-w-0 flex-1 flex-col gap-1">
			<div class="flex items-center gap-1.5">
				<span class={labelCls}>Dot Size</span>
				<Tooltip>
					<TooltipTrigger
						class="inline-flex h-5 min-w-[1.55rem] cursor-help items-center justify-center rounded-full border-none bg-transparent px-0.5 font-heading text-[0.6rem] leading-none font-bold tracking-[0.14em] text-muted-foreground transition-colors duration-150 hover:bg-accent/50 hover:text-foreground focus-visible:bg-accent/50 focus-visible:text-foreground focus-visible:outline-none"
						aria-label="Dot size guidance">[i]</TooltipTrigger
					>
					<TooltipContent
						side="top"
						sideOffset={6}
						class="max-w-72 px-3 py-2.5 text-[0.72rem] leading-[1.45]"
					>
						Small dot sizes tend to scan better in dark-background themes. Readers struggle more
						with dark-on-light QR codes at small sizes, especially when the connected lines are
						enabled.
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
						<TooltipContent
							side="top"
							sideOffset={6}
							class="max-w-56 px-2.5 py-2 text-[0.68rem] leading-[1.35]"
							>{dotSizeAvailabilityHint}</TooltipContent
						>
					</Tooltip>
				{/if}
			{/key}
		</div>
	</div>

	<!-- Corner Shape + Dot Union -->
	<div class="flex min-w-0 items-end gap-3 max-sm:flex-col max-sm:gap-3">
		<div class="relative flex min-w-0 flex-1 flex-col gap-1">
			<span class={labelCls}>Corner Shape</span>
			<div class="flex h-8 gap-0 border border-border" role="radiogroup" aria-label="Corner shape">
				{#each CAP_STYLE_VALUES as cap (cap)}
					{#if isCapStyleDisabled(cap)}
						<Tooltip>
							<TooltipTrigger>
								{#snippet child({ props })}
									<div
										{...props}
										class="flex flex-1 cursor-not-allowed border-r border-border last:border-r-0"
										aria-label={capStyleAvailabilityHint}
									>
										<button
											type="button"
											class="{radioCls} w-full !border-r-0 disabled:cursor-not-allowed disabled:opacity-45"
											role="radio"
											aria-checked={qrState.capStyle === cap}
											aria-label={CAP_STYLE_LABELS[cap]}
											aria-disabled="true"
											disabled
										>
											<svg
												class="size-4 overflow-visible"
												viewBox="0 0 16 16"
												fill="currentColor"
												aria-hidden="true"><path d={getCornerShapePath(cap)} /></svg
											>
										</button>
									</div>
								{/snippet}
							</TooltipTrigger>
							<TooltipContent
								side="top"
								sideOffset={6}
								class="max-w-56 px-2.5 py-2 text-[0.68rem] leading-[1.35]"
								>{capStyleAvailabilityHint}</TooltipContent
							>
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
							<svg
								class="size-4 overflow-visible"
								viewBox="0 0 16 16"
								fill="currentColor"
								aria-hidden="true"><path d={getCornerShapePath(cap)} /></svg
							>
						</button>
					{/if}
				{/each}
			</div>
		</div>

		<div class="relative flex min-w-0 flex-1 flex-col gap-1">
			<span class={labelCls}>Dot Union</span>
			{#if canConfigureConnections}
				<div class="flex h-8 gap-0 border border-border" role="radiogroup" aria-label="Dot union">
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
							<svg class="block size-4 overflow-visible" viewBox="0 0 16 16" aria-hidden="true">
								{#if getConnectionModePath(mode)}
									<path
										d={getConnectionModePath(mode)}
										fill="none"
										stroke="currentColor"
										stroke-width="1.8"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
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
							<div
								{...props}
								class="flex w-full cursor-not-allowed"
								aria-label={connectionModeAvailabilityHint}
							>
								<div
									class="flex h-8 w-full gap-0 border border-border"
									role="radiogroup"
									aria-label="Dot union"
								>
									{#each CONNECTION_MODE_VALUES as mode (mode)}
										<button
											type="button"
											class="{radioCls} {qrState.connectionMode === mode
												? radioActiveCls
												: ''} disabled:cursor-not-allowed disabled:opacity-45"
											role="radio"
											aria-checked={qrState.connectionMode === mode}
											aria-label={CONNECTION_MODE_LABELS[mode]}
											aria-disabled="true"
											disabled
										>
											<svg
												class="block size-4 overflow-visible"
												viewBox="0 0 16 16"
												aria-hidden="true"
											>
												{#if getConnectionModePath(mode)}
													<path
														d={getConnectionModePath(mode)}
														fill="none"
														stroke="currentColor"
														stroke-width="1.8"
														stroke-linecap="round"
														stroke-linejoin="round"
													/>
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
					<TooltipContent
						side="top"
						sideOffset={6}
						class="max-w-56 px-2.5 py-2 text-[0.68rem] leading-[1.35]"
						>{connectionModeAvailabilityHint}</TooltipContent
					>
				</Tooltip>
			{/if}
		</div>
	</div>

	<!-- Foreground + Background colors -->
	<div class="flex min-w-0 items-end gap-3 max-sm:flex-col max-sm:gap-3">
		<ColorInput
			label="Foreground"
			value={qrState.fgColor}
			oninput={(value) => qrState.setFgColor(value)}
		/>
		<ColorInput
			label="Background"
			value={qrState.bgColor}
			oninput={(value) => qrState.setBgColor(value)}
		/>
	</div>
</div>
