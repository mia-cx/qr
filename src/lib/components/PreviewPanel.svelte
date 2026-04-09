<script lang="ts">
	import { qrState } from '$lib/qr/state.svelte';
	import { generateQRSvg, generateQRCanvas, type ErrorCorrectionLevel } from '$lib/qr/generate';
	import { payloadLabels } from '$lib/qr/payloads';
	import { EC_LEVELS, EC_VALUES } from '$lib/qr/constants';
	import { onDestroy } from 'svelte';

	let exportCanvas: HTMLCanvasElement;
	let previewCanvas = $state<HTMLCanvasElement | undefined>(undefined);
	let copyStatus = $state<'idle' | 'done' | 'error'>('idle');
	let copyStatusReset: ReturnType<typeof setTimeout> | undefined;

	const canExport = $derived(Boolean(qrState.encodedData) && !qrState.isOverCapacity);
	const useRasterPreview = $derived(Boolean(qrState.encodedData));

	const previewStatusText = $derived.by(() => {
		if (!canExport) return 'QR preview will appear after you enter content.';
		return `${payloadLabels[qrState.payloadType]} QR preview ready. ${qrState.encodedData.length} characters encoded.`;
	});

	function getCurrentQrOptions() {
		return {
			data: qrState.encodedData,
			errorCorrection: qrState.errorCorrection,
			pixelSize: qrState.pixelSize,
			moduleStyle: qrState.moduleStyle,
			capStyle: qrState.capStyle,
			connectionMode: qrState.connectionMode,
			dotSize: qrState.dotSize,
			fgColor: qrState.fgColor,
			bgColor: qrState.bgColor,
			logo: qrState.logo,
			frameText: qrState.frameText
		};
	}

	function getExportSvg(): string {
		if (!canExport) return '';
		try { return generateQRSvg(getCurrentQrOptions()); } catch { return ''; }
	}

	async function exportAs(fmt: 'svg' | 'png' | 'jpg') {
		if (!canExport) return;
		const qrOptions = getCurrentQrOptions();
		if (fmt === 'svg') {
			const svg = getExportSvg();
			if (!svg) return;
			download(new Blob([svg], { type: 'image/svg+xml' }), 'qr.svg');
		} else {
			if (!exportCanvas) return;
			try { await generateQRCanvas(exportCanvas, qrOptions); } catch { return; }
			const mimeType = fmt === 'png' ? 'image/png' : 'image/jpeg';
			exportCanvas.toBlob((blob) => { if (blob) download(blob, `qr.${fmt}`); }, mimeType, 0.95);
		}
	}

	function scheduleCopyStatusReset() {
		if (copyStatusReset) clearTimeout(copyStatusReset);
		copyStatusReset = setTimeout(() => { copyStatus = 'idle'; }, 1400);
	}

	async function copyToClipboard() {
		if (!canExport || !exportCanvas || typeof ClipboardItem === 'undefined') return;
		try {
			await generateQRCanvas(exportCanvas, getCurrentQrOptions());
			const pngBlob = await new Promise<Blob | null>((resolve) => { exportCanvas.toBlob((blob) => resolve(blob), 'image/png'); });
			if (!pngBlob) throw new Error('Failed to encode preview image');
			await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
			copyStatus = 'done';
		} catch { copyStatus = 'error'; }
		scheduleCopyStatusReset();
	}

	function download(blob: Blob, filename: string) {
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	function moveRadioSelection<T extends string>(values: readonly T[], current: T, direction: 1 | -1) {
		const currentIndex = values.indexOf(current);
		return values[(currentIndex + direction + values.length) % values.length];
	}

	function handleErrorCorrectionKeydown(e: KeyboardEvent, current: ErrorCorrectionLevel) {
		if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
		e.preventDefault();
		const direction = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
		qrState.setErrorCorrection(moveRadioSelection(EC_VALUES, current, direction));
	}

	$effect(() => {
		if (!useRasterPreview || !previewCanvas || !qrState.encodedData || qrState.isOverCapacity || typeof window === 'undefined') return;
		const qrOptions = getCurrentQrOptions();
		const debounce = Math.round(Math.min(qrState.encodedByteLength / 1500, 1) * 150);
		let canceled = false;
		const timeout = window.setTimeout(() => {
			void (async () => {
				if (!canceled && previewCanvas) {
					try { await generateQRCanvas(previewCanvas, qrOptions); } catch { /* keep previous preview */ }
				}
			})();
		}, debounce);
		return () => { canceled = true; clearTimeout(timeout); };
	});

	onDestroy(() => { if (copyStatusReset) clearTimeout(copyStatusReset); });

	const exportBtnCls = "flex flex-1 items-center justify-center gap-1.5 p-2 bg-background text-foreground border border-foreground text-xs font-semibold cursor-pointer transition-colors duration-150 hover:bg-foreground hover:text-background disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2";
</script>

<canvas bind:this={exportCanvas} class="hidden" aria-hidden="true"></canvas>
<p class="sr-only" aria-live="polite">{previewStatusText}</p>

<div class="relative flex flex-1 items-center justify-center min-h-0 overflow-hidden">
	{#if useRasterPreview}
		<canvas bind:this={previewCanvas} class="w-full h-full object-contain [image-rendering:pixelated]" aria-hidden="true"></canvas>
	{:else}
		<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.5" class="text-muted-foreground opacity-20">
			<rect x="2" y="2" width="7" height="7" />
			<rect x="15" y="2" width="7" height="7" />
			<rect x="2" y="15" width="7" height="7" />
			<rect x="11" y="11" width="2" height="2" />
			<rect x="15" y="15" width="7" height="7" />
		</svg>
	{/if}
</div>

<div class="flex flex-col gap-1 mt-auto border-t border-border pt-2.5">
	<span class="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground leading-5">Error Correction</span>
	<div class="flex gap-0 h-8 border border-border" role="radiogroup" aria-label="Error correction level">
		{#each EC_LEVELS as level (level.value)}
			<button
				type="button"
				class="flex-1 inline-flex items-center justify-center p-0 bg-secondary border-0 border-r border-border text-muted-foreground text-sm font-medium cursor-pointer transition-colors duration-150 last:border-r-0 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 {qrState.errorCorrection === level.value ? 'bg-accent !text-foreground !font-semibold' : ''}"
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
	<button type="button" class={exportBtnCls} aria-label="Download QR code as PNG" disabled={!canExport} onclick={() => exportAs('png')}>
		<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v8m0 0L5 7.5M8 10l3-2.5M3 12h10" /></svg>
		<span class="tracking-tight">PNG</span>
	</button>
	<button type="button" class={exportBtnCls} aria-label="Download QR code as JPG" disabled={!canExport} onclick={() => exportAs('jpg')}>
		<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v8m0 0L5 7.5M8 10l3-2.5M3 12h10" /></svg>
		<span class="tracking-tight">JPG</span>
	</button>
	<button type="button" class={exportBtnCls} aria-label="Download QR code as SVG" disabled={!canExport} onclick={() => exportAs('svg')}>
		<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v8m0 0L5 7.5M8 10l3-2.5M3 12h10" /></svg>
		<span class="tracking-tight">SVG</span>
	</button>
	<button
		type="button"
		class="shrink-0 grow-0 inline-flex items-center justify-center p-0 aspect-square bg-foreground text-background border border-foreground text-xs font-semibold cursor-pointer transition-colors duration-150 hover:bg-background hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
		aria-label={copyStatus === 'done' ? 'Copied QR code to clipboard' : copyStatus === 'error' ? 'Retry copying QR code to clipboard' : 'Copy QR code to clipboard'}
		disabled={!canExport}
		onclick={copyToClipboard}
	>
		<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
			<rect x="4" y="4" width="8" height="8" />
			<path d="M4 10H3a1 1 0 01-1-1V3a1 1 0 011-1h6a1 1 0 011 1v1" />
		</svg>
	</button>
</div>
