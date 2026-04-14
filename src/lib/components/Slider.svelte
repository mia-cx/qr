<script lang="ts">
	interface Props {
		value: number;
		min: number;
		max: number;
		step: number;
		disabled?: boolean;
		label: string;
		formatValue?: (v: number) => string;
		oninput: (value: number) => void;
	}

	let { value, min, max, step, disabled = false, label, formatValue, oninput }: Props = $props();

	const THUMB_W = 44;
	let trackEl = $state<HTMLDivElement | undefined>(undefined);
	let trackW = $state(0);
	let progress = $derived(((value - min) / (max - min)) * 100);
	let displayValue = $derived(formatValue ? formatValue(value) : String(value));
	let thumbLeft = $derived(trackW > 0 ? (progress / 100) * (trackW - THUMB_W) + THUMB_W / 2 : 0);

	$effect(() => {
		if (!trackEl) return;
		const ro = new ResizeObserver(([entry]) => {
			trackW = entry.contentRect.width;
		});
		ro.observe(trackEl);
		return () => ro.disconnect();
	});
</script>

<div class="slider-wrapper" class:disabled>
	<div class="slider-track" bind:this={trackEl}>
		<div class="slider-fill" style:width="{progress}%"></div>
		<input
			type="range"
			{min}
			{max}
			{step}
			{disabled}
			{value}
			aria-label={label}
			oninput={(e) => oninput(Number(e.currentTarget.value))}
		/>
		<span class="slider-thumb-label" style:left="{thumbLeft}px">{displayValue}</span>
	</div>
</div>

<style>
	.slider-wrapper {
		display: flex;
		align-items: center;
	}

	.slider-wrapper.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.slider-track {
		flex: 1;
		position: relative;
		height: 32px;
		background: var(--background);
		border: 1px solid var(--border);
		overflow: hidden;
	}

	.slider-fill {
		position: absolute;
		inset: 0;
		width: 0;
		background: color-mix(in srgb, var(--foreground) 12%, transparent);
		pointer-events: none;
	}

	input[type='range'] {
		-webkit-appearance: none;
		appearance: none;
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		background: transparent;
		cursor: pointer;
		margin: 0;
		padding: 0;
	}

	input[type='range']:disabled {
		cursor: not-allowed;
	}

	input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 44px;
		height: 30px;
		border: none;
		border-radius: 0;
		background: var(--foreground);
	}

	input[type='range']::-moz-range-thumb {
		width: 44px;
		height: 30px;
		border: none;
		border-radius: 0;
		background: var(--foreground);
	}

	input[type='range']::-webkit-slider-runnable-track {
		height: 100%;
		background: transparent;
		border: none;
	}

	input[type='range']::-moz-range-track {
		height: 100%;
		background: transparent;
		border: none;
	}

	input[type='range']:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
	}

	.slider-thumb-label {
		position: absolute;
		top: 50%;
		transform: translate(-50%, -50%);
		font-size: 0.6rem;
		font-weight: 700;
		color: var(--background);
		pointer-events: none;
		white-space: nowrap;
	}
</style>
