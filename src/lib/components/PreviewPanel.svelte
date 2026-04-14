<script lang="ts">
	import { qrState } from '$lib/qr/state.svelte';
	import { generateQRSvg, generateQRCanvas, type ErrorCorrectionLevel } from '$lib/qr/generate';
	import { payloadLabels } from '$lib/qr/payloads';
	import { EC_LEVELS, EC_VALUES } from '$lib/qr/constants';
	import { downloadBlob, moveRadioSelection } from '$lib/utils';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import QrCodeIcon from '@lucide/svelte/icons/qr-code';
	import { onDestroy } from 'svelte';

	let exportCanvas: HTMLCanvasElement;
	let previewCanvas = $state<HTMLCanvasElement | undefined>(undefined);
	let copyStatus = $state<'idle' | 'done' | 'error'>('idle');
	let copyStatusReset: ReturnType<typeof setTimeout> | undefined;

	const canExport = $derived(Boolean(qrState.encodedData) && !qrState.isOverCapacity);
	const currentQrOptions = $derived.by(() => qrState.getCurrentQrOptions());
	const useRasterPreview = $derived(Boolean(qrState.encodedData));

	const previewStatusText = $derived.by(() => {
		if (!canExport) return 'QR preview will appear after you enter content.';
		return `${payloadLabels[qrState.payloadType]} QR preview ready. ${qrState.encodedData.length} characters encoded.`;
	});

	function getExportSvg(): string {
		if (!canExport) return '';
		try {
			return generateQRSvg(currentQrOptions);
		} catch {
			return '';
		}
	}

	async function exportAs(fmt: 'svg' | 'png' | 'jpg') {
		if (!canExport) return;
		if (fmt === 'svg') {
			const svg = getExportSvg();
			if (!svg) return;
			downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'qr.svg');
		} else {
			if (!exportCanvas) return;
			try {
				await generateQRCanvas(exportCanvas, currentQrOptions);
			} catch {
				return;
			}
			const mimeType = fmt === 'png' ? 'image/png' : 'image/jpeg';
			exportCanvas.toBlob(
				(blob) => {
					if (blob) downloadBlob(blob, `qr.${fmt}`);
				},
				mimeType,
				0.95
			);
		}
	}

	function scheduleCopyStatusReset() {
		if (copyStatusReset) clearTimeout(copyStatusReset);
		copyStatusReset = setTimeout(() => {
			copyStatus = 'idle';
		}, 1400);
	}

	async function copyToClipboard() {
		if (!canExport || !exportCanvas || typeof ClipboardItem === 'undefined') return;
		try {
			await generateQRCanvas(exportCanvas, currentQrOptions);
			const pngBlob = await new Promise<Blob | null>((resolve) => {
				exportCanvas.toBlob((blob) => resolve(blob), 'image/png');
			});
			if (!pngBlob) throw new Error('Failed to encode preview image');
			await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
			copyStatus = 'done';
		} catch {
			copyStatus = 'error';
		}
		scheduleCopyStatusReset();
	}

	function handleErrorCorrectionKeydown(e: KeyboardEvent, current: ErrorCorrectionLevel) {
		if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
		e.preventDefault();
		const direction = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
		qrState.setErrorCorrection(moveRadioSelection(EC_VALUES, current, direction));
	}

	$effect(() => {
		if (
			!useRasterPreview ||
			!previewCanvas ||
			!qrState.encodedData ||
			qrState.isOverCapacity ||
			typeof window === 'undefined'
		)
			return;

		const qrOptions = currentQrOptions;
		const debounce = Math.round(Math.min(qrState.encodedByteLength / 1500, 1) * 150);
		let canceled = false;
		const timeout = window.setTimeout(() => {
			void (async () => {
				if (!canceled && previewCanvas) {
					try {
						await generateQRCanvas(previewCanvas, qrOptions);
					} catch {
						/* keep previous preview */
					}
				}
			})();
		}, debounce);
		return () => {
			canceled = true;
			clearTimeout(timeout);
		};
	});

	onDestroy(() => {
		if (copyStatusReset) clearTimeout(copyStatusReset);
	});

	const exportBtnCls =
		'flex flex-1 items-center justify-center gap-1.5 p-2 bg-background text-foreground border border-foreground text-xs font-semibold cursor-pointer transition-colors duration-150 hover:bg-foreground hover:text-background disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2';
</script>

<canvas bind:this={exportCanvas} class="hidden" aria-hidden="true"></canvas>
<p class="sr-only" aria-live="polite">{previewStatusText}</p>

<div class="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
	{#if useRasterPreview}
		<canvas
			bind:this={previewCanvas}
			class="h-full w-full object-contain [image-rendering:pixelated]"
			aria-hidden="true"
		></canvas>
	{:else}
		<QrCodeIcon class="size-16 text-muted-foreground opacity-20" strokeWidth={0.8} />
	{/if}
</div>

<div class="mt-auto flex flex-col gap-1 border-t border-border pt-2.5">
	<span
		class="text-[0.65rem] leading-5 font-semibold tracking-wider text-muted-foreground uppercase"
		>Error Correction</span
	>
	<div
		class="flex h-8 gap-0 border border-border"
		role="radiogroup"
		aria-label="Error correction level"
	>
		{#each EC_LEVELS as level (level.value)}
			<button
				type="button"
				class="inline-flex flex-1 cursor-pointer items-center justify-center border-0 border-r border-border bg-secondary p-0 text-sm font-medium text-muted-foreground transition-colors duration-150 last:border-r-0 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring {qrState.errorCorrection ===
				level.value
					? 'bg-accent !font-semibold !text-foreground'
					: ''}"
				role="radio"
				aria-checked={qrState.errorCorrection === level.value}
				onkeydown={(e) => handleErrorCorrectionKeydown(e, level.value)}
				onclick={() => qrState.setErrorCorrection(level.value)}
			>
				{level.label} <span class="text-[0.65rem] font-normal opacity-60">{level.pct}</span>
			</button>
		{/each}
	</div>
</div>

<div class="flex gap-1.5 pt-2.5" role="group" aria-label="Export QR code">
	<button
		type="button"
		class={exportBtnCls}
		aria-label="Download QR code as PNG"
		disabled={!canExport}
		onclick={() => exportAs('png')}
	>
		<DownloadIcon class="size-3.5" strokeWidth={1.5} />
		<span class="tracking-tight">PNG</span>
	</button>
	<button
		type="button"
		class={exportBtnCls}
		aria-label="Download QR code as JPG"
		disabled={!canExport}
		onclick={() => exportAs('jpg')}
	>
		<DownloadIcon class="size-3.5" strokeWidth={1.5} />
		<span class="tracking-tight">JPG</span>
	</button>
	<button
		type="button"
		class={exportBtnCls}
		aria-label="Download QR code as SVG"
		disabled={!canExport}
		onclick={() => exportAs('svg')}
	>
		<DownloadIcon class="size-3.5" strokeWidth={1.5} />
		<span class="tracking-tight">SVG</span>
	</button>
	<button
		type="button"
		class="inline-flex aspect-square shrink-0 grow-0 cursor-pointer items-center justify-center border border-foreground bg-foreground p-0 text-xs font-semibold text-background transition-colors duration-150 hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-30"
		aria-label={copyStatus === 'done'
			? 'Copied QR code to clipboard'
			: copyStatus === 'error'
				? 'Retry copying QR code to clipboard'
				: 'Copy QR code to clipboard'}
		disabled={!canExport}
		onclick={copyToClipboard}
	>
		<CopyIcon class="size-3.5" strokeWidth={1.5} aria-hidden="true" />
	</button>
</div>
