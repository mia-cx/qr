<script lang="ts">
	import { qrState } from '$lib/qr/state.svelte';
	import { focusCls } from '$lib/utils';
	import { readQRFromFile, readQRFromImageData, createScreenCapture, type QRReadResult } from '$lib/qr/reader';
	import { decodePayload } from '$lib/qr/payloads';
	import ReaderResult from '$lib/components/ReaderResult.svelte';
	import { onDestroy } from 'svelte';

	interface Props { onswitchtogenerate: () => void; }
	let { onswitchtogenerate }: Props = $props();

	let readerResult = $state('');
	let readerError = $state('');
	let isDragging = $state(false);
	let isCapturing = $state(false);
	let captureMode = $state<'webcam' | 'screen' | null>(null);
	let showCaptureMenu = $state(false);
	let captureController = $state<{ start: () => Promise<void>; stop: () => void } | null>(null);
	let webcamStream = $state<MediaStream | null>(null);
	let captureGeneration = 0;
	let webcamVideo = $state<HTMLVideoElement | undefined>(undefined);
	let webcamScanFrame = $state<number | null>(null);

	function applyReaderResult(result: QRReadResult) { readerResult = result.data; readerError = result.error ?? ''; }
	function resetReaderState() { readerResult = ''; readerError = ''; }

	async function processReaderFile(file: File) {
		if (!file.type.startsWith('image/')) { applyReaderResult({ data: '', success: false, error: 'Choose an image file with a QR code' }); return; }
		resetReaderState();
		applyReaderResult(await readQRFromFile(file));
	}

	function loadResultIntoGenerator() {
		if (!readerResult) return;
		const decoded = decodePayload(readerResult);
		qrState.replacePayload(decoded.type, decoded.fields as never);
		onswitchtogenerate();
	}

	async function handleFileDrop(e: DragEvent) { e.preventDefault(); isDragging = false; const file = e.dataTransfer?.files[0]; if (file) await processReaderFile(file); }
	async function handleFileSelect(e: Event) { const input = e.target as HTMLInputElement; const file = input.files?.[0]; if (file) await processReaderFile(file); input.value = ''; }

	export async function handleGlobalPaste(e: ClipboardEvent) {
		const items = e.clipboardData?.items;
		if (!items) return;
		for (const item of items) {
			if (item.type.startsWith('image/')) { e.preventDefault(); const file = item.getAsFile(); if (file) await processReaderFile(file); return; }
		}
	}

	async function startWebcam() {
		stopCapture(); resetReaderState(); showCaptureMenu = false; captureMode = 'webcam'; isCapturing = true;
		const generation = ++captureGeneration;
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
			if (generation !== captureGeneration) { stream.getTracks().forEach((t) => t.stop()); return; }
			webcamStream = stream;
			await new Promise((r) => setTimeout(r, 100));
			if (webcamVideo) { webcamVideo.srcObject = webcamStream; await webcamVideo.play(); scanWebcamFrame(); }
		} catch { readerError = 'Camera access denied'; stopCapture(); }
	}

	function scanWebcamFrame() {
		if (!webcamVideo || !webcamStream) return;
		if (webcamVideo.readyState !== webcamVideo.HAVE_ENOUGH_DATA) { webcamScanFrame = requestAnimationFrame(scanWebcamFrame); return; }
		const canvas = document.createElement('canvas');
		canvas.width = webcamVideo.videoWidth; canvas.height = webcamVideo.videoHeight;
		const ctx = canvas.getContext('2d')!;
		ctx.drawImage(webcamVideo, 0, 0);
		const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
		const result = readQRFromImageData(imageData);
		if (result.success) { applyReaderResult(result); stopCapture(); return; }
		webcamScanFrame = requestAnimationFrame(scanWebcamFrame);
	}

	function startScreenCapture() {
		stopCapture(); resetReaderState(); showCaptureMenu = false; captureMode = 'screen'; isCapturing = true;
		const controller = createScreenCapture(
			(imageData: ImageData) => { const result = readQRFromImageData(imageData); if (result.success) { applyReaderResult(result); stopCapture(); } },
			(err: string) => { readerError = err; stopCapture(); }
		);
		captureController = controller; void controller.start();
	}

	function stopCapture() {
		captureController?.stop(); captureController = null;
		if (webcamScanFrame !== null) { cancelAnimationFrame(webcamScanFrame); webcamScanFrame = null; }
		if (webcamStream) { webcamStream.getTracks().forEach((t) => t.stop()); webcamStream = null; }
		isCapturing = false; captureMode = null;
	}

	function handleCaptureMenuTriggerKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showCaptureMenu = true; return; }
		if (e.key === 'Escape') showCaptureMenu = false;
	}

	onDestroy(stopCapture);

	const btnCls = `flex items-center gap-1.5 px-3 py-2 bg-secondary border border-border text-foreground text-sm cursor-pointer transition-colors duration-150 hover:bg-accent ${focusCls}`;
</script>

<svelte:window onclick={() => { if (showCaptureMenu) showCaptureMenu = false; }} />

<section
	class="flex flex-col items-center gap-2 p-6 border border-dashed border-border text-center transition-all duration-150 cursor-default {isDragging ? '!border-foreground bg-accent' : ''}"
	aria-labelledby="reader-upload-title"
	aria-describedby="reader-upload-help"
	ondragover={(e) => { e.preventDefault(); isDragging = true; }}
	ondragleave={() => (isDragging = false)}
	ondrop={handleFileDrop}
>
	<svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" class="text-muted-foreground opacity-50">
		<rect x="4" y="4" width="24" height="24" stroke-dasharray="4 2" />
		<path d="M16 10v12M12 18l4 4 4-4" />
	</svg>
	<h4 id="reader-upload-title" class="m-0 text-sm text-muted-foreground">Drag & drop an image here</h4>
	<div class="flex items-center gap-2">
		<label class="{btnCls} inline-flex">
			<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 13V4a1 1 0 011-1h3l2 2h5a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1z" /></svg>
			Browse
			<input type="file" accept="image/*" class="sr-only" aria-label="Browse for a QR image" onchange={handleFileSelect} />
		</label>
		<span class="text-xs text-muted-foreground opacity-60">or</span>
		<div class="relative">
			<button
				type="button"
				class={btnCls}
				aria-haspopup="menu"
				aria-expanded={showCaptureMenu}
				aria-controls="capture-menu"
				onclick={(e) => { e.stopPropagation(); showCaptureMenu = !showCaptureMenu; }}
				onkeydown={handleCaptureMenuTriggerKeydown}
			>
				<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="3.5" width="14" height="10" /><circle cx="8" cy="8.5" r="2.5" /><path d="M5 3.5L6 1.5h4l1 2" /></svg>
				Capture
			</button>
			{#if showCaptureMenu}
				<div id="capture-menu" class="absolute top-full left-0 z-50 bg-popover border border-border min-w-[140px]" role="menu" aria-label="Capture source" tabindex="-1" onpointerdown={(e) => e.stopPropagation()}>
					<button type="button" class="flex items-center gap-2 w-full px-3 py-2 bg-transparent border-0 border-b border-border text-foreground text-sm cursor-pointer text-left hover:bg-accent {focusCls}" role="menuitem" onclick={startWebcam}>
						<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="7" r="5" /><circle cx="7" cy="7" r="2" /></svg>
						Webcam
					</button>
					<button type="button" class="flex items-center gap-2 w-full px-3 py-2 bg-transparent border-0 text-foreground text-sm cursor-pointer text-left hover:bg-accent {focusCls}" role="menuitem" onclick={startScreenCapture}>
						<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="2" width="12" height="9" /><path d="M5 13h4" /></svg>
						Screen
					</button>
				</div>
			{/if}
		</div>
	</div>
	<p id="reader-upload-help" class="text-xs text-muted-foreground opacity-60">Paste from clipboard with <kbd class="px-1.5 py-0.5 border border-border font-sans text-[0.65rem] bg-secondary">Cmd+V</kbd></p>
</section>

<div class="flex flex-col gap-2">
	{#if isCapturing && captureMode === 'webcam'}
		<div class="relative">
			<video bind:this={webcamVideo} playsinline class="w-full border border-border" aria-label="Live webcam preview for QR scanning"></video>
			<button type="button" class="px-2 py-1 bg-destructive text-white border-none text-xs cursor-pointer ml-auto {focusCls}" onclick={stopCapture}>Stop</button>
		</div>
	{/if}
	{#if isCapturing && captureMode === 'screen'}
		<div class="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground border border-border" role="status" aria-live="polite">
			<span class="size-2 bg-red-500 animate-pulse"></span>
			Scanning screen...
			<button type="button" class="px-2 py-1 bg-destructive text-white border-none text-xs cursor-pointer ml-auto {focusCls}" onclick={stopCapture}>Stop</button>
		</div>
	{/if}
</div>

{#if readerResult}
	<ReaderResult raw={readerResult} onuse={loadResultIntoGenerator} />
{/if}

{#if readerError}
	<p class="text-sm text-destructive" role="alert">{readerError}</p>
{/if}
