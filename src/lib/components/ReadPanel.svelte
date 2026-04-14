<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { qrState } from '$lib/qr/state.svelte';
	import {
		readQRFromFile,
		readQRFromImageData,
		createScreenCapture,
		type QRReadResult
	} from '$lib/qr/reader';
	import { decodePayload } from '$lib/qr/payloads';
	import ReaderResult from '$lib/components/ReaderResult.svelte';
	import { focusCls } from '$lib/utils';
	import CameraIcon from '@lucide/svelte/icons/camera';
	import FolderOpenIcon from '@lucide/svelte/icons/folder-open';
	import MonitorIcon from '@lucide/svelte/icons/monitor';
	import { onDestroy } from 'svelte';

	interface Props {
		onswitchtogenerate: () => void;
	}
	let { onswitchtogenerate }: Props = $props();

	let readerResult = $state('');
	let readerError = $state('');
	let isDragging = $state(false);
	let isCapturing = $state(false);
	let captureMode = $state<'webcam' | 'screen' | null>(null);
	let captureController = $state<{ start: () => Promise<void>; stop: () => void } | null>(null);
	let webcamStream = $state<MediaStream | null>(null);
	let captureGeneration = 0;
	let webcamVideo = $state<HTMLVideoElement | undefined>(undefined);
	let webcamScanFrame = $state<number | null>(null);

	function applyReaderResult(result: QRReadResult) {
		readerResult = result.data;
		readerError = result.error ?? '';
	}
	function resetReaderState() {
		readerResult = '';
		readerError = '';
	}

	async function processReaderFile(file: File) {
		if (!file.type.startsWith('image/')) {
			applyReaderResult({ data: '', success: false, error: 'Choose an image file with a QR code' });
			return;
		}
		resetReaderState();
		applyReaderResult(await readQRFromFile(file));
	}

	function loadResultIntoGenerator() {
		if (!readerResult) return;
		const decoded = decodePayload(readerResult);
		qrState.replacePayload(decoded.type, decoded.fields as never);
		onswitchtogenerate();
	}

	async function handleFileDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		const file = e.dataTransfer?.files[0];
		if (file) await processReaderFile(file);
	}
	async function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) await processReaderFile(file);
		input.value = '';
	}

	export async function handleGlobalPaste(e: ClipboardEvent) {
		const items = e.clipboardData?.items;
		if (!items) return;
		for (const item of items) {
			if (item.type.startsWith('image/')) {
				e.preventDefault();
				const file = item.getAsFile();
				if (file) await processReaderFile(file);
				return;
			}
		}
	}

	async function startWebcam() {
		stopCapture();
		resetReaderState();
		captureMode = 'webcam';
		isCapturing = true;
		const generation = ++captureGeneration;
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: 'environment' }
			});
			if (generation !== captureGeneration) {
				stream.getTracks().forEach((t) => t.stop());
				return;
			}
			webcamStream = stream;
			await new Promise((r) => setTimeout(r, 100));
			if (webcamVideo) {
				webcamVideo.srcObject = webcamStream;
				await webcamVideo.play();
				scanWebcamFrame();
			}
		} catch {
			readerError = 'Camera access denied';
			stopCapture();
		}
	}

	function scanWebcamFrame() {
		if (!webcamVideo || !webcamStream) return;
		if (webcamVideo.readyState !== webcamVideo.HAVE_ENOUGH_DATA) {
			webcamScanFrame = requestAnimationFrame(scanWebcamFrame);
			return;
		}
		const canvas = document.createElement('canvas');
		canvas.width = webcamVideo.videoWidth;
		canvas.height = webcamVideo.videoHeight;
		const ctx = canvas.getContext('2d')!;
		ctx.drawImage(webcamVideo, 0, 0);
		const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
		const result = readQRFromImageData(imageData);
		if (result.success) {
			applyReaderResult(result);
			stopCapture();
			return;
		}
		webcamScanFrame = requestAnimationFrame(scanWebcamFrame);
	}

	function startScreenCapture() {
		stopCapture();
		resetReaderState();
		captureMode = 'screen';
		isCapturing = true;
		const controller = createScreenCapture(
			(imageData: ImageData) => {
				const result = readQRFromImageData(imageData);
				if (result.success) {
					applyReaderResult(result);
					stopCapture();
				}
			},
			(err: string) => {
				readerError = err;
				stopCapture();
			}
		);
		captureController = controller;
		void controller.start();
	}

	function stopCapture() {
		captureController?.stop();
		captureController = null;
		if (webcamScanFrame !== null) {
			cancelAnimationFrame(webcamScanFrame);
			webcamScanFrame = null;
		}
		if (webcamStream) {
			webcamStream.getTracks().forEach((t) => t.stop());
			webcamStream = null;
		}
		isCapturing = false;
		captureMode = null;
	}

	onDestroy(stopCapture);

	const btnCls = `flex items-center gap-1.5 px-3 py-2 bg-secondary border border-border text-foreground text-sm cursor-pointer transition-colors duration-150 hover:bg-accent ${focusCls}`;
</script>

<section
	class="flex cursor-default flex-col items-center gap-2 border border-dashed border-border p-6 text-center transition-all duration-150 {isDragging
		? '!border-foreground bg-accent'
		: ''}"
	aria-labelledby="reader-upload-title"
	aria-describedby="reader-upload-help"
	ondragover={(e) => {
		e.preventDefault();
		isDragging = true;
	}}
	ondragleave={() => (isDragging = false)}
	ondrop={handleFileDrop}
>
	<FolderOpenIcon class="size-8 text-muted-foreground opacity-50" strokeWidth={1.5} />
	<h4 id="reader-upload-title" class="m-0 text-sm text-muted-foreground">
		Drag & drop an image here
	</h4>
	<div class="flex items-center gap-2">
		<label class="{btnCls} inline-flex">
			<FolderOpenIcon class="size-3.5" strokeWidth={1.5} />
			Browse
			<input
				type="file"
				accept="image/*"
				class="sr-only"
				aria-label="Browse for a QR image"
				onchange={handleFileSelect}
			/>
		</label>
		<span class="text-xs text-muted-foreground opacity-60">or</span>
		<DropdownMenu.DropdownMenu>
			<DropdownMenu.DropdownMenuTrigger class={btnCls}>
				<CameraIcon class="size-3.5" strokeWidth={1.5} />
				Capture
			</DropdownMenu.DropdownMenuTrigger>
			<DropdownMenu.DropdownMenuContent align="start" sideOffset={4} class="min-w-[140px]">
				<DropdownMenu.DropdownMenuItem onclick={startWebcam}>
					<CameraIcon class="size-3.5" strokeWidth={1.5} />
					Webcam
				</DropdownMenu.DropdownMenuItem>
				<DropdownMenu.DropdownMenuItem onclick={startScreenCapture}>
					<MonitorIcon class="size-3.5" strokeWidth={1.5} />
					Screen
				</DropdownMenu.DropdownMenuItem>
			</DropdownMenu.DropdownMenuContent>
		</DropdownMenu.DropdownMenu>
	</div>
	<p id="reader-upload-help" class="text-xs text-muted-foreground opacity-60">
		Paste from clipboard with <kbd
			class="border border-border bg-secondary px-1.5 py-0.5 font-sans text-[0.65rem]">Cmd+V</kbd
		>
	</p>
</section>

<p class="border border-border bg-secondary px-3 py-2 text-xs leading-[1.45] text-muted-foreground" role="note">
	Reader disclaimer: this feature is still in development and currently works best with
	basic, easy-to-read QR codes. Some QR codes generated with this app may also not be
	readable yet.
</p>

<div class="flex flex-col gap-2">
	{#if isCapturing && captureMode === 'webcam'}
		<div class="relative">
			<video
				bind:this={webcamVideo}
				playsinline
				class="w-full border border-border"
				aria-label="Live webcam preview for QR scanning"
			></video>
			<button
				type="button"
				class="ml-auto cursor-pointer border-none bg-destructive px-2 py-1 text-xs text-white {focusCls}"
				onclick={stopCapture}>Stop</button
			>
		</div>
	{/if}
	{#if isCapturing && captureMode === 'screen'}
		<div
			class="flex items-center gap-2 border border-border px-3 py-2 text-sm text-muted-foreground"
			role="status"
			aria-live="polite"
		>
			<span class="size-2 animate-pulse bg-red-500"></span>
			Scanning screen...
			<button
				type="button"
				class="ml-auto cursor-pointer border-none bg-destructive px-2 py-1 text-xs text-white {focusCls}"
				onclick={stopCapture}>Stop</button
			>
		</div>
	{/if}
</div>

{#if readerResult}
	<ReaderResult raw={readerResult} onuse={loadResultIntoGenerator} />
{/if}

{#if readerError}
	<p class="text-sm text-destructive" role="alert">{readerError}</p>
{/if}
