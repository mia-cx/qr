<script lang="ts">
	import { page } from '$app/state';
	import { deLocalizeUrl } from '$lib/paraglide/runtime';
	import { qrState } from '$lib/qr/state.svelte';
	import {
		themes,
		getTheme,
		getInitialThemeId,
		setTheme,
		getQrColors,
		themeStore,
		applyDocumentTheme
	} from '$lib/themes';
	import { generateQRSvg, generateQRCanvas } from '$lib/qr/generate';
	import {
		readQRFromFile,
		readQRFromImageData,
		createScreenCapture,
		type QRReadResult
	} from '$lib/qr/reader';
	import { payloadLabels, decodePayload, type PayloadType } from '$lib/qr/payloads';
	import {
		MIN_PIXEL_SIZE_FOR_CUSTOM_DOTS,
		MIN_PIXEL_SIZE_FOR_DECORATIVE_CAPS,
		MAX_DOT_SIZE,
		getMinimumPixelPerfectDotSize,
		getPixelPerfectDotSizeStep,
		isCapStyleAvailable,
		isConnectionModeConfigurable,
		isDotSizeConfigurable,
		type ErrorCorrectionLevel,
		type CapStyle,
		type ConnectionMode
	} from '$lib/qr/generate';
	import { onDestroy, onMount } from 'svelte';
	import Dropdown from '$lib/components/Dropdown.svelte';
	import Slider from '$lib/components/Slider.svelte';
	import DateRangePicker from '$lib/components/DateRangePicker.svelte';
	import ReaderResult from '$lib/components/ReaderResult.svelte';
	import { Tooltip, TooltipContent, TooltipTrigger } from '$lib/components/ui/tooltip';
	import { getStudioSectionForPath } from '$lib/routes/studio';

	// --- State ---
	let activeSection = $state<'generate' | 'read'>('generate');
	let activeStep = $state<'payload' | 'styling'>('payload');
	let exportCanvas: HTMLCanvasElement;
	let previewCanvas = $state<HTMLCanvasElement | undefined>(undefined);
	let copyStatus = $state<'idle' | 'done' | 'error'>('idle');
	let copyStatusReset: ReturnType<typeof setTimeout> | undefined;

	// Reader state
	let readerResult = $state('');
	let readerError = $state('');
	let isDragging = $state(false);
	let showWifiPassword = $state(false);
	let isCapturing = $state(false);
	let captureMode = $state<'webcam' | 'screen' | null>(null);
	let showCaptureMenu = $state(false);
	let captureController = $state<{ start: () => Promise<void>; stop: () => void } | null>(null);
	let webcamStream = $state<MediaStream | null>(null);
	let captureGeneration = 0;
	let webcamVideo = $state<HTMLVideoElement | undefined>(undefined);
	let webcamScanFrame = $state<number | null>(null);
	let pixelRatioInput = $state(String(qrState.pixelSize));
	let pixelRatioMenuOpen = $state(false);
	let pixelRatioActiveIndex = $state(-1);
	let pixelRatioInputEl = $state<HTMLInputElement | undefined>(undefined);
	let fgColorInput = $state(qrState.fgColor.toUpperCase());
	let bgColorInput = $state(qrState.bgColor.toUpperCase());
	let fgColorPicker = $state<HTMLInputElement | undefined>(undefined);
	let bgColorPicker = $state<HTMLInputElement | undefined>(undefined);

	const payloadTypeItems = (Object.entries(payloadLabels) as [PayloadType, string][]).map(
		([value, label]) => ({ value, label })
	);
	const suggestedPixelSizes = [1, 3, 8, 16, 32];
	const pixelSizeItems = suggestedPixelSizes.map((s) => ({
		value: String(s),
		label: String(s)
	}));
	const ecLevels: { value: ErrorCorrectionLevel; label: string; pct: string }[] = [
		{ value: 'L', label: 'L', pct: '7%' },
		{ value: 'M', label: 'M', pct: '15%' },
		{ value: 'Q', label: 'Q', pct: '25%' },
		{ value: 'H', label: 'H', pct: '30%' }
	];
	const wifiEncryptionValues = ['WPA', 'WEP', 'nopass'] as const;
	const errorCorrectionValues: ErrorCorrectionLevel[] = ['L', 'M', 'Q', 'H'];
	const capStyleValues: CapStyle[] = ['square', 'circle', 'miter'];
	const connectionModeValues: ConnectionMode[] = ['disconnected', 'lines'];
	const capStyleLabels: Record<CapStyle, string> = {
		square: 'Square corner',
		circle: 'Rounded corner',
		miter: 'Mitered corner'
	};
	const connectionModeLabels: Record<ConnectionMode, string> = {
		disconnected: 'Separated dots',
		lines: 'Unioned dots'
	};
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

	const canExport = $derived(Boolean(qrState.encodedData) && !qrState.isOverCapacity);

	function getExportSvg(): string {
		if (!canExport) return '';
		try {
			return generateQRSvg(getCurrentQrOptions());
		} catch {
			return '';
		}
	}

	// --- Auto-detection ---
	const urlPattern = /^(https?:\/\/|www\.)/i;
	const whitespacePattern = /\s/;
	const phonePattern = /^\+?[\d\s\-().]{7,}$/;
	const autoDetectTypes: PayloadType[] = ['url', 'text', 'phone'];

	function handlePrimaryInput(value: string) {
		const currentType = qrState.payloadType;

		// Only auto-switch from auto-detectable types
		if (!autoDetectTypes.includes(currentType)) {
			updatePrimaryField(value);
			return;
		}

		// Determine the target type
		let targetType: PayloadType;
		if (urlPattern.test(value) && !whitespacePattern.test(value)) {
			targetType = 'url';
		} else if (phonePattern.test(value) && value.replace(/\D/g, '').length >= 7) {
			targetType = 'phone';
		} else {
			targetType = 'text';
		}

		// Switch type and sync value to all simple fields so switching back preserves it
		qrState.setAutoDetectedPrimaryValue(targetType, value);
	}

	function updatePrimaryField(value: string) {
		const t = qrState.payloadType;
		if (t === 'url') qrState.setPayloadField('url', 'url', value);
		else if (t === 'text') qrState.setPayloadField('text', 'text', value);
		else if (t === 'phone') qrState.setPayloadField('phone', 'number', value);
	}

	function getPrimaryValue(): string {
		const t = qrState.payloadType;
		if (t === 'url') return qrState.payloads.url.url;
		if (t === 'text') return qrState.payloads.text.text;
		if (t === 'phone') return qrState.payloads.phone.number;
		return '';
	}

	function getPrimaryPlaceholder(): string {
		const t = qrState.payloadType;
		if (t === 'url') return 'https://example.com';
		if (t === 'text') return 'Enter text...';
		if (t === 'phone') return '+1 234 567 8900';
		if (t === 'email') return 'recipient@example.com';
		if (t === 'wifi') return 'Network name (SSID)';
		if (t === 'sms') return 'Phone number';
		if (t === 'vcard') return 'First name';
		if (t === 'calendar') return 'Event title';
		if (t === 'geo') return 'Latitude';
		if (t === 'mecard') return 'Name';
		return 'Enter data...';
	}

	function getPrimaryLabel(): string {
		const t = qrState.payloadType;
		if (t === 'url') return 'URL';
		if (t === 'text') return 'Text';
		if (t === 'phone') return 'Phone number';
		return 'QR content';
	}

	// Whether the current type has a simple primary field or needs a multi-field form
	const isSimpleType = $derived(['url', 'text', 'phone'].includes(qrState.payloadType));
	const themeItems = themes.map((t) => ({ value: t.id, label: t.name }));
	const previewStatusText = $derived.by(() => {
		if (!canExport) {
			return 'QR preview will appear after you enter content.';
		}

		return `${payloadLabels[qrState.payloadType]} QR preview ready. ${qrState.encodedData.length} characters encoded.`;
	});
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
	const useRasterPreview = $derived(Boolean(qrState.encodedData));
	const pixelRatioMenuId = 'pixel-ratio-suggestions';

	function isCapStyleDisabled(capStyle: CapStyle): boolean {
		return !isCapStyleAvailable(qrState.pixelSize, capStyle);
	}

	function getCornerShapeLabel(capStyle: CapStyle): string {
		return capStyleLabels[capStyle];
	}

	function getConnectionModeLabel(connectionMode: ConnectionMode): string {
		return connectionModeLabels[connectionMode];
	}

	function getConnectionModeDots(connectionMode: ConnectionMode) {
		return connectionMode === 'lines'
			? [
					{ cx: 4, cy: 4 },
					{ cx: 12, cy: 4 },
					{ cx: 12, cy: 12 },
					{ cx: 4, cy: 12 }
				]
			: [
					{ cx: 4, cy: 4 },
					{ cx: 12, cy: 4 },
					{ cx: 4, cy: 12 },
					{ cx: 12, cy: 12 }
				];
	}

	function getConnectionModePath(connectionMode: ConnectionMode): string | null {
		return connectionMode === 'lines' ? 'M4 4H12V12' : null;
	}

	function normalizeHexColor(value: string): string | null {
		const trimmed = value.trim();
		const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
		const hex = withHash.slice(1);

		if (!/^[\da-fA-F]{3}$|^[\da-fA-F]{6}$/.test(hex)) {
			return null;
		}

		if (hex.length === 3) {
			const expanded = hex
				.split('')
				.map((char) => char + char)
				.join('');
			return `#${expanded.toUpperCase()}`;
		}

		return `#${hex.toUpperCase()}`;
	}

	function updateColorInput(kind: 'fg' | 'bg', value: string) {
		if (kind === 'fg') {
			fgColorInput = value.toUpperCase();
		} else {
			bgColorInput = value.toUpperCase();
		}

		const normalized = normalizeHexColor(value);
		if (!normalized) return;

		if (kind === 'fg') {
			qrState.setFgColor(normalized);
		} else {
			qrState.setBgColor(normalized);
		}
	}

	function commitColorInput(kind: 'fg' | 'bg') {
		const value = kind === 'fg' ? fgColorInput : bgColorInput;
		const fallback = kind === 'fg' ? qrState.fgColor : qrState.bgColor;
		const normalized = normalizeHexColor(value);
		const nextValue = normalized ?? fallback;

		if (kind === 'fg') {
			fgColorInput = nextValue.toUpperCase();
			if (normalized) qrState.setFgColor(nextValue);
		} else {
			bgColorInput = nextValue.toUpperCase();
			if (normalized) qrState.setBgColor(nextValue);
		}
	}

	function openColorPicker(kind: 'fg' | 'bg') {
		const picker = kind === 'fg' ? fgColorPicker : bgColorPicker;
		picker?.click();
	}

	function getCornerShapePath(capStyle: CapStyle): string {
		switch (capStyle) {
			case 'square':
				return 'M2.5 2.5H13.5V13.5H2.5Z';
			case 'circle':
				return 'M8 2.5H13.5V13.5H2.5V8A5.5 5.5 0 0 1 8 2.5Z';
			case 'miter':
				return 'M8 2.5H13.5V13.5H2.5V8Z';
		}
	}

	function openPixelRatioMenu() {
		pixelRatioMenuOpen = true;
		pixelRatioActiveIndex = -1;
	}

	function closePixelRatioMenu() {
		pixelRatioMenuOpen = false;
		pixelRatioActiveIndex = -1;
	}

	function commitPixelRatio(rawValue = pixelRatioInput) {
		const normalized = rawValue.replace(/\D+/g, '');
		if (!normalized) {
			pixelRatioInput = String(qrState.pixelSize);
			closePixelRatioMenu();
			return;
		}

		const nextValue = Number.parseInt(normalized, 10);
		if (!Number.isFinite(nextValue) || nextValue < 1) {
			pixelRatioInput = String(qrState.pixelSize);
			closePixelRatioMenu();
			return;
		}

		qrState.setPixelSize(nextValue);
		pixelRatioInput = String(qrState.pixelSize);
		closePixelRatioMenu();
	}

	function selectPixelRatio(value: string) {
		pixelRatioInput = value;
		commitPixelRatio(value);
	}

	function handlePixelRatioInput(event: Event) {
		const nextValue = (event.currentTarget as HTMLInputElement).value.replace(/\D+/g, '');
		pixelRatioInput = nextValue;
		pixelRatioMenuOpen = true;
		pixelRatioActiveIndex = -1;
	}

	function handlePixelRatioKeydown(event: KeyboardEvent) {
		const items = pixelSizeItems;

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			if (!items.length) {
				openPixelRatioMenu();
				return;
			}

			pixelRatioMenuOpen = true;
			pixelRatioActiveIndex =
				pixelRatioActiveIndex < 0 ? 0 : (pixelRatioActiveIndex + 1) % items.length;
			return;
		}

		if (event.key === 'ArrowUp') {
			event.preventDefault();
			if (!items.length) {
				openPixelRatioMenu();
				return;
			}

			pixelRatioMenuOpen = true;
			pixelRatioActiveIndex =
				pixelRatioActiveIndex < 0
					? items.length - 1
					: (pixelRatioActiveIndex - 1 + items.length) % items.length;
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

	// --- Theme ---
	let currentTheme = $state(getInitialThemeId());
	const routeSection = $derived(getStudioSectionForPath(deLocalizeUrl(page.url).pathname));

	onMount(() => {
		const unsubscribeTheme = themeStore.subscribe((id) => {
			currentTheme = id;
			applyDocumentTheme(id);
			const { fg, bg } = getQrColors();
			qrState.applyThemeColors(fg, bg);
		});

		const revealApp = async () => {
			try {
				await document.fonts.ready;
			} catch {
				// Font readiness is a progressive enhancement for the reveal timing.
			}

			document.documentElement.setAttribute('data-app-ready', 'true');
		};

		void revealApp();

		return unsubscribeTheme;
	});

	$effect(() => {
		if (routeSection) {
			activeSection = routeSection;
		}
	});

	$effect(() => {
		pixelRatioInput = String(qrState.pixelSize);
	});

	$effect(() => {
		fgColorInput = qrState.fgColor.toUpperCase();
	});

	$effect(() => {
		bgColorInput = qrState.bgColor.toUpperCase();
	});

	$effect(() => {
		if (pixelRatioActiveIndex >= pixelSizeItems.length) {
			pixelRatioActiveIndex = Math.max(pixelSizeItems.length - 1, -1);
		}
	});

	function switchTheme(id: string) {
		setTheme(id);
	}

	onDestroy(() => {
		if (copyStatusReset) {
			clearTimeout(copyStatusReset);
		}
		stopCapture();
	});

	// --- Export ---
	async function exportAs(fmt: 'svg' | 'png' | 'jpg') {
		if (!canExport) return;
		const qrOptions = getCurrentQrOptions();

		if (fmt === 'svg') {
			const svg = getExportSvg();
			if (!svg) return;
			const blob = new Blob([svg], { type: 'image/svg+xml' });
			download(blob, 'qr.svg');
		} else {
			if (!exportCanvas) return;
			try {
				await generateQRCanvas(exportCanvas, qrOptions);
			} catch {
				return;
			}
			const mimeType = fmt === 'png' ? 'image/png' : 'image/jpeg';
			exportCanvas.toBlob(
				(blob) => {
					if (blob) download(blob, `qr.${fmt}`);
				},
				mimeType,
				0.95
			);
		}
	}

	function scheduleCopyStatusReset() {
		if (copyStatusReset) {
			clearTimeout(copyStatusReset);
		}

		copyStatusReset = setTimeout(() => {
			copyStatus = 'idle';
		}, 1400);
	}

	async function copyToClipboard() {
		if (!canExport || !exportCanvas || typeof ClipboardItem === 'undefined') return;

		try {
			await generateQRCanvas(exportCanvas, getCurrentQrOptions());
			const pngBlob = await new Promise<Blob | null>((resolve) => {
				exportCanvas.toBlob((blob) => resolve(blob), 'image/png');
			});
			if (!pngBlob) {
				throw new Error('Failed to encode preview image');
			}

			await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
			copyStatus = 'done';
		} catch {
			copyStatus = 'error';
		}

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
			applyReaderResult({
				data: '',
				success: false,
				error: 'Choose an image file with a QR code'
			});
			return;
		}

		resetReaderState();
		applyReaderResult(await readQRFromFile(file));
	}

	function loadResultIntoGenerator() {
		if (!readerResult) return;

		const decoded = decodePayload(readerResult);
		qrState.replacePayload(decoded.type, decoded.fields as never);
		activeSection = 'generate';
		activeStep = 'payload';
	}

	// --- Reader ---
	async function handleFileDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		const file = e.dataTransfer?.files[0];
		if (!file) return;

		await processReaderFile(file);
	}

	async function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		await processReaderFile(file);
		input.value = '';
	}

	async function handleGlobalPaste(e: ClipboardEvent) {
		if (activeSection !== 'read') return;
		const items = e.clipboardData?.items;
		if (!items) return;
		for (const item of items) {
			if (item.type.startsWith('image/')) {
				e.preventDefault();
				const file = item.getAsFile();
				if (file) {
					await processReaderFile(file);
				}
				return;
			}
		}
	}

	async function startWebcam() {
		stopCapture();
		resetReaderState();
		showCaptureMenu = false;
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
		showCaptureMenu = false;
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
		if (captureController) {
			captureController.stop();
			captureController = null;
		}
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

	function handleWindowClick() {
		if (showCaptureMenu) {
			showCaptureMenu = false;
		}

		if (pixelRatioMenuOpen) {
			pixelRatioMenuOpen = false;
		}
	}

	function moveRadioSelection<T extends string>(
		values: readonly T[],
		current: T,
		direction: 1 | -1
	) {
		const currentIndex = values.indexOf(current);
		const nextIndex = (currentIndex + direction + values.length) % values.length;
		return values[nextIndex];
	}

	function handleWifiEncryptionKeydown(
		e: KeyboardEvent,
		current: (typeof wifiEncryptionValues)[number]
	) {
		if (
			e.key !== 'ArrowRight' &&
			e.key !== 'ArrowDown' &&
			e.key !== 'ArrowLeft' &&
			e.key !== 'ArrowUp'
		) {
			return;
		}

		e.preventDefault();
		const direction = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
		qrState.setPayloadField(
			'wifi',
			'encryption',
			moveRadioSelection(wifiEncryptionValues, current, direction)
		);
	}

	function handleErrorCorrectionKeydown(e: KeyboardEvent, current: ErrorCorrectionLevel) {
		if (
			e.key !== 'ArrowRight' &&
			e.key !== 'ArrowDown' &&
			e.key !== 'ArrowLeft' &&
			e.key !== 'ArrowUp'
		) {
			return;
		}

		e.preventDefault();
		const direction = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
		qrState.setErrorCorrection(moveRadioSelection(errorCorrectionValues, current, direction));
	}

	function handleCapStyleKeydown(e: KeyboardEvent, current: CapStyle) {
		if (
			e.key !== 'ArrowRight' &&
			e.key !== 'ArrowDown' &&
			e.key !== 'ArrowLeft' &&
			e.key !== 'ArrowUp'
		) {
			return;
		}

		e.preventDefault();
		const direction = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
		const availableCapStyles = capStyleValues.filter((capStyle) =>
			isCapStyleAvailable(qrState.pixelSize, capStyle)
		);
		qrState.setCapStyle(moveRadioSelection(availableCapStyles, current, direction));
	}

	function handleConnectionModeKeydown(e: KeyboardEvent, current: ConnectionMode) {
		if (
			e.key !== 'ArrowRight' &&
			e.key !== 'ArrowDown' &&
			e.key !== 'ArrowLeft' &&
			e.key !== 'ArrowUp'
		) {
			return;
		}

		e.preventDefault();
		const direction = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
		qrState.setConnectionMode(moveRadioSelection(connectionModeValues, current, direction));
	}

	$effect(() => {
		if (
			!useRasterPreview ||
			!previewCanvas ||
			!qrState.encodedData ||
			qrState.isOverCapacity ||
			typeof window === 'undefined'
		) {
			return;
		}

		const qrOptions = getCurrentQrOptions();
		const debounce = Math.round(Math.min(qrState.encodedByteLength / 1500, 1) * 150);
		let canceled = false;
		const timeout = window.setTimeout(() => {
			void (async () => {
				if (!canceled && previewCanvas) {
					try {
						await generateQRCanvas(previewCanvas, qrOptions);
					} catch {
						// Leave the previous preview in place if raster rendering fails.
					}
				}
			})();
		}, debounce);

		return () => {
			canceled = true;
			clearTimeout(timeout);
		};
	});

	function handleCaptureMenuTriggerKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			showCaptureMenu = true;
			return;
		}

		if (e.key === 'Escape') {
			showCaptureMenu = false;
		}
	}
</script>

<svelte:window onpaste={handleGlobalPaste} onclick={handleWindowClick} />
<svelte:head>
	<title>qr.mia.cx</title>
	<meta name="description" content="QR code generator and reader" />
</svelte:head>

<canvas bind:this={exportCanvas} class="hidden" aria-hidden="true"></canvas>

<main class="page">
	<h1 class="sr-only">QR code generator and reader</h1>
	<div class="card" aria-labelledby="app-subtitle">
		<header class="card-header">
			<div class="header-left" id="app-subtitle">
				<span class="logo">QR</span>
				<span class="logo-domain">.mia.cx</span>
			</div>
			<Dropdown
				items={themeItems}
				value={currentTheme}
				onselect={(id) => switchTheme(id)}
				align="right"
				label="Theme"
			>
				{#snippet trigger({ open, value })}
					<span class="theme-dropdown-trigger">
						<span class="trigger-swatch" style="background: {getTheme(value).accent}"></span>
						<span class="trigger-theme-name">{getTheme(value).name}</span>
						<svg
							class="type-dropdown-chevron"
							class:open
							width="14"
							height="14"
							viewBox="0 0 14 14"
							fill="none"
							stroke="currentColor"
							stroke-width="1.5"><path d="M4 6l3 3 3-3" /></svg
						>
					</span>
				{/snippet}
				{#snippet children({ value, label, selected })}
					<span
						class="theme-dropdown-item"
						class:selected
						style="background: {getTheme(value).bg}; color: {getTheme(value).fg};"
					>
						<span class="swatch-dot" style="background: {getTheme(value).accent}"></span>
						{label}
					</span>
				{/snippet}
			</Dropdown>
		</header>

		<!-- Left: Form -->
		<section class="card-left" aria-labelledby="controls-heading">
			<h2 id="controls-heading" class="sr-only">QR controls</h2>

			<!-- Accordion: Generate -->
			<h3 class="accordion-heading">
				<button
					type="button"
					class="accordion-trigger"
					class:expanded={activeSection === 'generate'}
					aria-expanded={activeSection === 'generate'}
					aria-controls="generate-panel"
					id="generate-trigger"
					onclick={() => (activeSection = 'generate')}
				>
					<span class="accordion-title" class:large={activeSection === 'generate'}
						>Create a QR code</span
					>
					<svg
						class="accordion-chevron"
						class:open={activeSection === 'generate'}
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						aria-hidden="true"><path d="M4 6l4 4 4-4" /></svg
					>
				</button>
			</h3>

			<div
				id="generate-panel"
				class="accordion-panel"
				class:open={activeSection === 'generate'}
				role="region"
				aria-labelledby="generate-trigger"
			>
				<div class="accordion-content">
					<!-- Sub-accordion: Payload -->
					<h4 class="sub-accordion-heading">
						<button
							type="button"
							class="sub-accordion-trigger"
							class:expanded={activeStep === 'payload'}
							aria-expanded={activeStep === 'payload'}
							aria-controls="payload-panel"
							id="payload-trigger"
							onclick={() => (activeStep = 'payload')}
						>
							<span class="sub-accordion-title" class:active={activeStep === 'payload'}>Payload</span>
							<span class="byte-budget-inline" class:over={qrState.isOverCapacity}>
								<span class="byte-budget-bar">
									<span
										class="byte-budget-fill"
										style:width="{Math.min((qrState.encodedByteLength / qrState.maxBytes) * 100, 100)}%"
									></span>
								</span>
								<span class="byte-budget-label">
									{qrState.encodedByteLength}<span class="byte-budget-sep">/</span>{qrState.maxBytes}
								</span>
							</span>
							<svg
								class="accordion-chevron"
								class:open={activeStep === 'payload'}
								width="14"
								height="14"
								viewBox="0 0 16 16"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
								aria-hidden="true"><path d="M4 6l4 4 4-4" /></svg
							>
						</button>
					</h4>

					<div
						id="payload-panel"
						class="sub-accordion-panel"
						class:open={activeStep === 'payload'}
						role="region"
						aria-labelledby="payload-trigger"
					>
						<div class="sub-accordion-content">
							<section class="generate-form" class:over-capacity={qrState.isOverCapacity} aria-label="QR generation form">
						<!-- Type Selector -->
						<Dropdown
							items={payloadTypeItems}
							value={qrState.payloadType}
							label="QR content type"
							onselect={(v) => {
								qrState.setPayloadType(v as PayloadType);
							}}
						>
							{#snippet trigger({ open, value })}
								<span class="type-dropdown-trigger">
									<span class="type-dropdown-label">Type</span>
									<span class="type-dropdown-value">{payloadLabels[value as PayloadType]}</span>
									<svg
										class="type-dropdown-chevron"
										class:open
										width="14"
										height="14"
										viewBox="0 0 14 14"
										fill="none"
										stroke="currentColor"
										stroke-width="1.5"><path d="M4 6l3 3 3-3" /></svg
									>
								</span>
							{/snippet}
						</Dropdown>

						<!-- Primary field (with auto-detect for simple types) -->
						{#if isSimpleType}
							<div class="field field-fill">
								<textarea
									class="input textarea text-payload-input"
									aria-label={getPrimaryLabel()}
									placeholder={getPrimaryPlaceholder()}
									value={getPrimaryValue()}
									oninput={(e) => handlePrimaryInput(e.currentTarget.value)}
								></textarea>
							</div>
						{:else}
							<!-- Multi-field forms -->
							<div class="fields">
								{#if qrState.payloadType === 'wifi'}
									<label class="labeled-input">
										<span class="labeled-input-tag">SSID</span>
										<input
											class="input"
											type="text"
											aria-label="Wi-Fi network name"
											value={qrState.payloads.wifi.ssid}
											oninput={(e) => qrState.setPayloadField('wifi', 'ssid', e.currentTarget.value)}
										/>
									</label>
									<label class="labeled-input">
										<span class="labeled-input-tag">Password</span>
										<div class="password-input-wrapper">
											<input
												class="input password-input"
												type={showWifiPassword ? 'text' : 'password'}
												aria-label="Wi-Fi password"
												value={qrState.payloads.wifi.password}
												oninput={(e) =>
													qrState.setPayloadField('wifi', 'password', e.currentTarget.value)}
											/>
											<button
												type="button"
												class="password-eye"
												aria-label={showWifiPassword ? 'Hide password' : 'Show password'}
												onclick={() => (showWifiPassword = !showWifiPassword)}
											>
												{#if showWifiPassword}
													<svg
														width="16"
														height="16"
														viewBox="0 0 16 16"
														fill="none"
														stroke="currentColor"
														stroke-width="1.5"
														><path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" /><circle
															cx="8"
															cy="8"
															r="2"
														/></svg
													>
												{:else}
													<svg
														width="16"
														height="16"
														viewBox="0 0 16 16"
														fill="none"
														stroke="currentColor"
														stroke-width="1.5"
														><path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" /><circle
															cx="8"
															cy="8"
															r="2"
														/><path d="M3 13L13 3" /></svg
													>
												{/if}
											</button>
										</div>
									</label>
									<div class="inline-options">
										<span class="field-label" id="wifi-encryption-label">Encryption</span>
										<div
											class="toggle-group"
											role="radiogroup"
											aria-labelledby="wifi-encryption-label"
										>
											{#each ['WPA', 'WEP', 'None'] as enc (enc)}
												{@const val = (
													enc === 'None' ? 'nopass' : enc
												) as (typeof wifiEncryptionValues)[number]}
												<button
													type="button"
													class="toggle-item"
													class:active={qrState.payloads.wifi.encryption === val}
													role="radio"
													aria-checked={qrState.payloads.wifi.encryption === val}
													onkeydown={(e) => handleWifiEncryptionKeydown(e, val)}
													onclick={() => qrState.setPayloadField('wifi', 'encryption', val)}
													>{enc}</button
												>
											{/each}
										</div>
									</div>
									<div class="inline-options">
										<span class="field-label">Hidden network</span>
										<button
											type="button"
											class="custom-checkbox"
											class:checked={qrState.payloads.wifi.hidden}
											aria-label="Hidden network"
											aria-pressed={qrState.payloads.wifi.hidden}
											onclick={() =>
												qrState.setPayloadField('wifi', 'hidden', !qrState.payloads.wifi.hidden)}
										>
											{#if qrState.payloads.wifi.hidden}
												<svg
													width="12"
													height="12"
													viewBox="0 0 12 12"
													fill="none"
													stroke="currentColor"
													stroke-width="2"><path d="M2 6l3 3 5-5" /></svg
												>
											{/if}
										</button>
									</div>
								{:else if qrState.payloadType === 'sms'}
									<label class="labeled-input">
										<span class="labeled-input-tag">Phone</span>
										<input
											class="input"
											type="tel"
											aria-label="SMS phone number"
											value={qrState.payloads.sms.number}
											oninput={(e) => qrState.setPayloadField('sms', 'number', e.currentTarget.value)}
										/>
									</label>
									<label class="labeled-input">
										<span class="labeled-input-tag">Message</span>
										<textarea
											class="input textarea"
											aria-label="SMS message"
											rows="2"
											value={qrState.payloads.sms.message}
											oninput={(e) =>
												qrState.setPayloadField('sms', 'message', e.currentTarget.value)}
										></textarea>
									</label>
								{:else if qrState.payloadType === 'email'}
									<label class="labeled-input">
										<span class="labeled-input-tag">Email</span>
										<input
											class="input"
											type="email"
											aria-label="Recipient email"
											value={qrState.payloads.email.to}
											oninput={(e) => qrState.setPayloadField('email', 'to', e.currentTarget.value)}
										/>
									</label>
									<label class="labeled-input">
										<span class="labeled-input-tag">Subject</span>
										<input
											class="input"
											type="text"
											aria-label="Email subject"
											value={qrState.payloads.email.subject}
											oninput={(e) =>
												qrState.setPayloadField('email', 'subject', e.currentTarget.value)}
										/>
									</label>
									<label class="labeled-input">
										<span class="labeled-input-tag">Body</span>
										<textarea
											class="input textarea"
											aria-label="Email body"
											rows="2"
											value={qrState.payloads.email.body}
											oninput={(e) => qrState.setPayloadField('email', 'body', e.currentTarget.value)}
										></textarea>
									</label>
								{:else if qrState.payloadType === 'vcard'}
									<div class="field-row">
										<label class="labeled-input">
											<span class="labeled-input-tag">First</span>
											<input
												class="input"
												type="text"
												aria-label="vCard first name"
												value={qrState.payloads.vcard.firstName}
												oninput={(e) =>
													qrState.setPayloadField('vcard', 'firstName', e.currentTarget.value)}
											/>
										</label>
										<label class="labeled-input">
											<span class="labeled-input-tag">Last</span>
											<input
												class="input"
												type="text"
												aria-label="vCard last name"
												value={qrState.payloads.vcard.lastName}
												oninput={(e) =>
													qrState.setPayloadField('vcard', 'lastName', e.currentTarget.value)}
											/>
										</label>
									</div>
									<label class="labeled-input">
										<span class="labeled-input-tag">Phone</span>
										<input
											class="input"
											type="tel"
											aria-label="vCard phone"
											value={qrState.payloads.vcard.phone}
											oninput={(e) =>
												qrState.setPayloadField('vcard', 'phone', e.currentTarget.value)}
										/>
									</label>
									<label class="labeled-input">
										<span class="labeled-input-tag">Email</span>
										<input
											class="input"
											type="email"
											aria-label="vCard email"
											value={qrState.payloads.vcard.email}
											oninput={(e) =>
												qrState.setPayloadField('vcard', 'email', e.currentTarget.value)}
										/>
									</label>
									<label class="labeled-input">
										<span class="labeled-input-tag">Org</span>
										<input
											class="input"
											type="text"
											aria-label="vCard organization"
											value={qrState.payloads.vcard.org}
											oninput={(e) => qrState.setPayloadField('vcard', 'org', e.currentTarget.value)}
										/>
									</label>
									<label class="labeled-input">
										<span class="labeled-input-tag">Title</span>
										<input
											class="input"
											type="text"
											aria-label="vCard title"
											value={qrState.payloads.vcard.title}
											oninput={(e) =>
												qrState.setPayloadField('vcard', 'title', e.currentTarget.value)}
										/>
									</label>
									<label class="labeled-input">
										<span class="labeled-input-tag">URL</span>
										<input
											class="input"
											type="url"
											aria-label="vCard website"
											value={qrState.payloads.vcard.url}
											oninput={(e) => qrState.setPayloadField('vcard', 'url', e.currentTarget.value)}
										/>
									</label>
									<label class="labeled-input">
										<span class="labeled-input-tag">Address</span>
										<input
											class="input"
											type="text"
											aria-label="vCard address"
											value={qrState.payloads.vcard.address}
											oninput={(e) =>
												qrState.setPayloadField('vcard', 'address', e.currentTarget.value)}
										/>
									</label>
								{:else if qrState.payloadType === 'calendar'}
									<label class="labeled-input">
										<span class="labeled-input-tag">Title</span>
										<input
											class="input"
											type="text"
											aria-label="Calendar event title"
											value={qrState.payloads.calendar.title}
											oninput={(e) =>
												qrState.setPayloadField('calendar', 'title', e.currentTarget.value)}
										/>
									</label>
									<label class="labeled-input">
										<span class="labeled-input-tag">Location</span>
										<input
											class="input"
											type="text"
											aria-label="Calendar location"
											value={qrState.payloads.calendar.location}
											oninput={(e) =>
												qrState.setPayloadField('calendar', 'location', e.currentTarget.value)}
										/>
									</label>
									<label class="labeled-input">
										<span class="labeled-input-tag">Details</span>
										<textarea
											class="input textarea"
											aria-label="Calendar description"
											rows="2"
											value={qrState.payloads.calendar.description}
											oninput={(e) =>
												qrState.setPayloadField('calendar', 'description', e.currentTarget.value)}
										></textarea>
									</label>
									<DateRangePicker
										label="Calendar event date and time range"
										start={qrState.payloads.calendar.start}
										end={qrState.payloads.calendar.end}
										onchange={(s, e) => {
											qrState.setPayloadField('calendar', 'start', s);
											qrState.setPayloadField('calendar', 'end', e);
										}}
									/>
								{:else if qrState.payloadType === 'geo'}
									<div class="field-row">
										<label class="labeled-input">
											<span class="labeled-input-tag">Lat</span>
											<input
												class="input"
												type="text"
												aria-label="Latitude"
												value={qrState.payloads.geo.latitude}
												oninput={(e) =>
													qrState.setPayloadField('geo', 'latitude', e.currentTarget.value)}
											/>
										</label>
										<label class="labeled-input">
											<span class="labeled-input-tag">Lng</span>
											<input
												class="input"
												type="text"
												aria-label="Longitude"
												value={qrState.payloads.geo.longitude}
												oninput={(e) =>
													qrState.setPayloadField('geo', 'longitude', e.currentTarget.value)}
											/>
										</label>
									</div>
								{:else if qrState.payloadType === 'mecard'}
									<label class="labeled-input">
										<span class="labeled-input-tag">Name</span>
										<input
											class="input"
											type="text"
											aria-label="MeCard name"
											value={qrState.payloads.mecard.name}
											oninput={(e) =>
												qrState.setPayloadField('mecard', 'name', e.currentTarget.value)}
										/>
									</label>
									<label class="labeled-input">
										<span class="labeled-input-tag">Phone</span>
										<input
											class="input"
											type="tel"
											aria-label="MeCard phone"
											value={qrState.payloads.mecard.phone}
											oninput={(e) =>
												qrState.setPayloadField('mecard', 'phone', e.currentTarget.value)}
										/>
									</label>
									<label class="labeled-input">
										<span class="labeled-input-tag">Email</span>
										<input
											class="input"
											type="email"
											aria-label="MeCard email"
											value={qrState.payloads.mecard.email}
											oninput={(e) =>
												qrState.setPayloadField('mecard', 'email', e.currentTarget.value)}
										/>
									</label>
									<label class="labeled-input">
										<span class="labeled-input-tag">URL</span>
										<input
											class="input"
											type="url"
											aria-label="MeCard website"
											value={qrState.payloads.mecard.url}
											oninput={(e) => qrState.setPayloadField('mecard', 'url', e.currentTarget.value)}
										/>
									</label>
									<label class="labeled-input">
										<span class="labeled-input-tag">Address</span>
										<input
											class="input"
											type="text"
											aria-label="MeCard address"
											value={qrState.payloads.mecard.address}
											oninput={(e) =>
												qrState.setPayloadField('mecard', 'address', e.currentTarget.value)}
										/>
									</label>
									<label class="labeled-input">
										<span class="labeled-input-tag">Note</span>
										<textarea
											class="input textarea"
											aria-label="MeCard note"
											rows="2"
											value={qrState.payloads.mecard.note}
											oninput={(e) =>
												qrState.setPayloadField('mecard', 'note', e.currentTarget.value)}
										></textarea>
									</label>
								{/if}
							</div>
						{/if}
							</section>
						</div>
					</div>

					<!-- Sub-accordion: Appearance -->
					<h4 class="sub-accordion-heading">
						<button
							type="button"
							class="sub-accordion-trigger"
							class:expanded={activeStep === 'styling'}
							aria-expanded={activeStep === 'styling'}
							aria-controls="styling-panel"
							id="styling-trigger"
							onclick={() => (activeStep = 'styling')}
						>
							<span class="sub-accordion-title" class:active={activeStep === 'styling'}>Appearance</span>
							<svg
								class="accordion-chevron"
								class:open={activeStep === 'styling'}
								width="14"
								height="14"
								viewBox="0 0 16 16"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
								aria-hidden="true"><path d="M4 6l4 4 4-4" /></svg
							>
						</button>
					</h4>

					<div
						id="styling-panel"
						class="sub-accordion-panel"
						class:open={activeStep === 'styling'}
						role="region"
						aria-labelledby="styling-trigger"
					>
						<div class="sub-accordion-content">
							<div class="styling-form">
						<div class="settings-row">
							<div class="mini-dropdown-wrapper pixel-ratio-setting">
								<span class="mini-dropdown-label">Pixel Ratio</span>
								<div class="ratio-field" onclick={(event) => event.stopPropagation()}>
									<div class="pixel-ratio-combobox">
										<label class="sr-only" for="pixel-ratio-input">Pixel ratio</label>
										<div
											class="mini-dropdown-trigger ratio-trigger ratio-input-shell"
											onclick={() => {
												pixelRatioInputEl?.focus();
												openPixelRatioMenu();
											}}
										>
											<input
												id="pixel-ratio-input"
												bind:this={pixelRatioInputEl}
												type="number"
												min="1"
												inputmode="numeric"
												pattern="[0-9]*"
												class="pixel-ratio-input"
												role="combobox"
												aria-label="Pixel ratio"
												aria-expanded={pixelRatioMenuOpen}
												aria-controls={pixelRatioMenuId}
												aria-activedescendant={pixelRatioMenuOpen &&
												pixelRatioActiveIndex >= 0 &&
												pixelSizeItems[pixelRatioActiveIndex]
													? `${pixelRatioMenuId}-${pixelSizeItems[pixelRatioActiveIndex].value}`
													: undefined}
												autocomplete="off"
												value={pixelRatioInput}
												onfocus={openPixelRatioMenu}
												oninput={handlePixelRatioInput}
												onkeydown={handlePixelRatioKeydown}
												onblur={() => {
													commitPixelRatio();
												}}
											/>
										</div>
										{#if pixelRatioMenuOpen && pixelSizeItems.length}
											<div
												id={pixelRatioMenuId}
												class="pixel-ratio-menu"
												role="listbox"
												aria-label="Suggested pixel ratios"
												onpointerdown={(event) => {
													event.preventDefault();
													event.stopPropagation();
												}}
												onclick={(event) => {
													event.stopPropagation();
												}}
											>
												{#each pixelSizeItems as item, index (item.value)}
													<button
														type="button"
														id={`${pixelRatioMenuId}-${item.value}`}
														class="pixel-ratio-option"
														class:active={index === pixelRatioActiveIndex}
														role="option"
														aria-selected={index === pixelRatioActiveIndex}
														onmouseenter={() => {
															pixelRatioActiveIndex = index;
														}}
														onpointerdown={(event) => {
															event.preventDefault();
															event.stopPropagation();
														}}
														onclick={(event) => {
															event.stopPropagation();
															selectPixelRatio(item.value);
														}}
													>
														<span class="ratio-item">{item.label}</span>
													</button>
												{/each}
											</div>
										{/if}
									</div>
									<span class="ratio-suffix">&nbsp;:&nbsp;1</span>
								</div>
							</div>

							<div class="mini-dropdown-wrapper">
								<div class="mini-dropdown-label-row">
									<span class="mini-dropdown-label">Dot Size</span>
									<Tooltip>
										<TooltipTrigger class="info-tooltip-trigger" aria-label="Dot size guidance">
											[i]
										</TooltipTrigger>
										<TooltipContent side="top" sideOffset={6} class="dot-size-tooltip">
											Small dot sizes tend to scan better in dark-background themes. Readers
											struggle more with dark-on-light QR codes at small sizes, especially when
											the connected lines are enabled.
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
													<div
														{...props}
														class="disabled-slider-trigger"
														aria-label={dotSizeAvailabilityHint}
													>
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
											<TooltipContent side="top" sideOffset={6} class="disabled-slider-tooltip">
												{dotSizeAvailabilityHint}
											</TooltipContent>
										</Tooltip>
									{/if}
								{/key}
							</div>
						</div>

						<div class="settings-row">
							<div class="mini-dropdown-wrapper">
								<span class="mini-dropdown-label">Corner Shape</span>
								<div class="ec-radio-group" role="radiogroup" aria-label="Corner shape">
									{#each capStyleValues as cap (cap)}
										{#if isCapStyleDisabled(cap)}
											<Tooltip>
												<TooltipTrigger>
													{#snippet child({ props })}
														<div
															{...props}
															class="disabled-cap-trigger"
															aria-label={capStyleAvailabilityHint}
														>
															<button
																type="button"
																class="ec-radio"
																role="radio"
																aria-checked={qrState.capStyle === cap}
																aria-label={getCornerShapeLabel(cap)}
																aria-disabled="true"
																disabled
															>
																<svg
																	class="corner-shape-icon"
																	viewBox="0 0 16 16"
																	fill="currentColor"
																	aria-hidden="true"
																>
																	<path d={getCornerShapePath(cap)} />
																</svg>
															</button>
														</div>
													{/snippet}
												</TooltipTrigger>
												<TooltipContent side="top" sideOffset={6} class="disabled-cap-tooltip">
													{capStyleAvailabilityHint}
												</TooltipContent>
											</Tooltip>
										{:else}
											<button
												type="button"
												class="ec-radio"
												class:active={qrState.capStyle === cap}
												role="radio"
												aria-checked={qrState.capStyle === cap}
												aria-label={getCornerShapeLabel(cap)}
												onkeydown={(e) => handleCapStyleKeydown(e, cap)}
												onclick={() => qrState.setCapStyle(cap)}
											>
												<svg
													class="corner-shape-icon"
													viewBox="0 0 16 16"
													fill="currentColor"
													aria-hidden="true"
												>
													<path d={getCornerShapePath(cap)} />
												</svg>
											</button>
										{/if}
									{/each}
								</div>
							</div>

							<div class="mini-dropdown-wrapper">
								<span class="mini-dropdown-label">Dot Union</span>
								{#if canConfigureConnections}
									<div class="ec-radio-group" role="radiogroup" aria-label="Dot union">
										{#each connectionModeValues as mode (mode)}
											<button
												type="button"
												class="ec-radio"
												class:active={qrState.connectionMode === mode}
												role="radio"
												aria-checked={qrState.connectionMode === mode}
												aria-label={getConnectionModeLabel(mode)}
												onkeydown={(e) => handleConnectionModeKeydown(e, mode)}
												onclick={() => qrState.setConnectionMode(mode)}
											>
												<svg
													class="connection-mode-icon"
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
								{:else}
									<Tooltip>
										<TooltipTrigger>
											{#snippet child({ props })}
												<div
													{...props}
													class="disabled-connection-trigger"
													aria-label={connectionModeAvailabilityHint}
												>
													<div class="ec-radio-group" role="radiogroup" aria-label="Dot union">
														{#each connectionModeValues as mode (mode)}
															<button
																type="button"
																class="ec-radio"
																class:active={qrState.connectionMode === mode}
																role="radio"
																aria-checked={qrState.connectionMode === mode}
																aria-label={getConnectionModeLabel(mode)}
																aria-disabled="true"
																disabled
															>
																<svg
																	class="connection-mode-icon"
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
																		<circle
																			cx={dot.cx}
																			cy={dot.cy}
																			r="1.35"
																			fill="currentColor"
																		/>
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
											class="disabled-connection-tooltip"
										>
											{connectionModeAvailabilityHint}
										</TooltipContent>
									</Tooltip>
								{/if}
							</div>
						</div>

						<div class="settings-row">
							<div class="mini-dropdown-wrapper">
								<span class="mini-dropdown-label">Foreground</span>
								<div class="color-field" role="group" aria-label="Foreground color">
									<button
										type="button"
										class="color-swatch-trigger"
										aria-label="Open foreground color picker"
										onclick={() => openColorPicker('fg')}
									>
										<span class="color-swatch" style={`background: ${qrState.fgColor}`}></span>
									</button>
									<input
										bind:this={fgColorPicker}
										type="color"
										class="color-picker-input"
										tabindex="-1"
										aria-hidden="true"
										value={qrState.fgColor}
										oninput={(e) => updateColorInput('fg', e.currentTarget.value)}
									/>
									<input
										type="text"
										class="color-text-input"
										inputmode="text"
										spellcheck="false"
										autocapitalize="characters"
										autocomplete="off"
										maxlength="7"
										aria-label="Foreground hex color"
										value={fgColorInput}
										oninput={(e) => updateColorInput('fg', e.currentTarget.value)}
										onblur={() => commitColorInput('fg')}
										onkeydown={(e) => {
											if (e.key === 'Enter') {
												e.preventDefault();
												commitColorInput('fg');
											}
										}}
									/>
								</div>
							</div>
							<div class="mini-dropdown-wrapper">
								<span class="mini-dropdown-label">Background</span>
								<div class="color-field" role="group" aria-label="Background color">
									<button
										type="button"
										class="color-swatch-trigger"
										aria-label="Open background color picker"
										onclick={() => openColorPicker('bg')}
									>
										<span class="color-swatch" style={`background: ${qrState.bgColor}`}></span>
									</button>
									<input
										bind:this={bgColorPicker}
										type="color"
										class="color-picker-input"
										tabindex="-1"
										aria-hidden="true"
										value={qrState.bgColor}
										oninput={(e) => updateColorInput('bg', e.currentTarget.value)}
									/>
									<input
										type="text"
										class="color-text-input"
										inputmode="text"
										spellcheck="false"
										autocapitalize="characters"
										autocomplete="off"
										maxlength="7"
										aria-label="Background hex color"
										value={bgColorInput}
										oninput={(e) => updateColorInput('bg', e.currentTarget.value)}
										onblur={() => commitColorInput('bg')}
										onkeydown={(e) => {
											if (e.key === 'Enter') {
												e.preventDefault();
												commitColorInput('bg');
											}
										}}
									/>
								</div>
							</div>
						</div>

							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Accordion: Read -->
			<h3 class="accordion-heading">
				<button
					type="button"
					class="accordion-trigger"
					class:expanded={activeSection === 'read'}
					aria-expanded={activeSection === 'read'}
					aria-controls="read-panel"
					id="read-trigger"
					onclick={() => (activeSection = 'read')}
				>
					<span class="accordion-title" class:large={activeSection === 'read'}>Read a QR code</span>
					<svg
						class="accordion-chevron"
						class:open={activeSection === 'read'}
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						aria-hidden="true"><path d="M4 6l4 4 4-4" /></svg
					>
				</button>
			</h3>

			<div
				id="read-panel"
				class="accordion-panel"
				class:open={activeSection === 'read'}
				role="region"
				aria-labelledby="read-trigger"
			>
				<div class="accordion-content">
					<section
						class="drop-zone"
						class:dragging={isDragging}
						aria-labelledby="reader-upload-title"
						aria-describedby="reader-upload-help"
						ondragover={(e) => {
							e.preventDefault();
							isDragging = true;
						}}
						ondragleave={() => (isDragging = false)}
						ondrop={handleFileDrop}
					>
						<svg
							width="32"
							height="32"
							viewBox="0 0 32 32"
							fill="none"
							stroke="currentColor"
							stroke-width="1.5"
							class="drop-icon"
						>
							<rect x="4" y="4" width="24" height="24" stroke-dasharray="4 2" />
							<path d="M16 10v12M12 18l4 4 4-4" />
						</svg>
						<h4 id="reader-upload-title" class="drop-text">Drag & drop an image here</h4>
						<div class="browse-capture-row">
							<label class="browse-btn">
								<svg
									width="14"
									height="14"
									viewBox="0 0 16 16"
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
									><path
										d="M2 13V4a1 1 0 011-1h3l2 2h5a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1z"
									/></svg
								>
								Browse
								<input
									type="file"
									accept="image/*"
									class="sr-only"
									aria-label="Browse for a QR image"
									onchange={handleFileSelect}
								/>
							</label>
							<span class="drop-hint">or</span>
							<div class="capture-row">
								<button
									type="button"
									class="capture-btn"
									aria-haspopup="menu"
									aria-expanded={showCaptureMenu}
									aria-controls="capture-menu"
									onclick={(e) => {
										e.stopPropagation();
										showCaptureMenu = !showCaptureMenu;
									}}
									onkeydown={handleCaptureMenuTriggerKeydown}
								>
									<svg
										width="14"
										height="14"
										viewBox="0 0 16 16"
										fill="none"
										stroke="currentColor"
										stroke-width="1.5"
										><rect x="1" y="3.5" width="14" height="10" /><circle
											cx="8"
											cy="8.5"
											r="2.5"
										/><path d="M5 3.5L6 1.5h4l1 2" /></svg
									>
									Capture
								</button>

								{#if showCaptureMenu}
									<div
										id="capture-menu"
										class="capture-menu"
										role="menu"
										aria-label="Capture source"
										tabindex="-1"
										onpointerdown={(e) => e.stopPropagation()}
									>
										<button
											type="button"
											class="capture-menu-item"
											role="menuitem"
											onclick={startWebcam}
										>
											<svg
												width="14"
												height="14"
												viewBox="0 0 14 14"
												fill="none"
												stroke="currentColor"
												stroke-width="1.5"
												><circle cx="7" cy="7" r="5" /><circle cx="7" cy="7" r="2" /></svg
											>
											Webcam
										</button>
										<button
											type="button"
											class="capture-menu-item"
											role="menuitem"
											onclick={startScreenCapture}
										>
											<svg
												width="14"
												height="14"
												viewBox="0 0 14 14"
												fill="none"
												stroke="currentColor"
												stroke-width="1.5"
												><rect x="1" y="2" width="12" height="9" /><path d="M5 13h4" /></svg
											>
											Screen
										</button>
									</div>
								{/if}
							</div>
						</div>
						<p id="reader-upload-help" class="drop-hint">
							Paste from clipboard with <kbd>Cmd+V</kbd>
						</p>
					</section>

					<div class="capture-section">
						{#if isCapturing && captureMode === 'webcam'}
							<div class="webcam-preview">
								<video
									bind:this={webcamVideo}
									playsinline
									class="webcam-video"
									aria-label="Live webcam preview for QR scanning"
								></video>
								<button type="button" class="stop-capture-btn" onclick={stopCapture}>Stop</button>
							</div>
						{/if}

						{#if isCapturing && captureMode === 'screen'}
							<div class="capture-status" role="status" aria-live="polite">
								<span class="capture-dot"></span>
								Scanning screen...
								<button type="button" class="stop-capture-btn" onclick={stopCapture}>Stop</button>
							</div>
						{/if}
					</div>

					{#if readerResult}
						<ReaderResult raw={readerResult} onuse={loadResultIntoGenerator} />
					{/if}

					{#if readerError}
						<p class="reader-error" role="alert">{readerError}</p>
					{/if}
				</div>
			</div>
		</section>

		<!-- Right: QR Preview -->
		<aside class="card-right" aria-labelledby="preview-heading">
			<h2 id="preview-heading" class="sr-only">QR preview and export options</h2>
			<p class="sr-only" aria-live="polite">{previewStatusText}</p>
			<div class="preview-area">
				{#if useRasterPreview}
					<canvas bind:this={previewCanvas} class="preview-canvas" aria-hidden="true"
					></canvas>
				{:else}
					<svg
						width="64"
						height="64"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="0.5"
						class="preview-empty-icon"
					>
						<rect x="2" y="2" width="7" height="7" />
						<rect x="15" y="2" width="7" height="7" />
						<rect x="2" y="15" width="7" height="7" />
						<rect x="11" y="11" width="2" height="2" />
						<rect x="15" y="15" width="7" height="7" />
					</svg>
				{/if}
			</div>

			<div class="error-correction-row">
				<span class="mini-dropdown-label">Error Correction</span>
				<div
					class="ec-radio-group"
					role="radiogroup"
					aria-label="Error correction level"
				>
					{#each ecLevels as level (level.value)}
						<button
							type="button"
							class="ec-radio"
							class:active={qrState.errorCorrection === level.value}
							role="radio"
							aria-checked={qrState.errorCorrection === level.value}
							onkeydown={(e) => handleErrorCorrectionKeydown(e, level.value)}
							onclick={() => {
								qrState.setErrorCorrection(level.value);
							}}
						>
							{level.label} <span class="ec-pct">{level.pct}</span>
						</button>
					{/each}
				</div>
			</div>

			<div class="export-row" role="group" aria-label="Export QR code">
					<button
						type="button"
						class="export-btn"
						aria-label="Download QR code as PNG"
						disabled={!canExport}
						onclick={() => exportAs('png')}
					>
						<svg
							width="14"
							height="14"
							viewBox="0 0 14 14"
							fill="none"
							stroke="currentColor"
							stroke-width="1.5"
						>
							<path d="M8 2v8m0 0L5 7.5M8 10l3-2.5M3 12h10" />
						</svg>
						<span class="export-format-label">PNG</span>
					</button>
					<button
						type="button"
						class="export-btn"
						aria-label="Download QR code as JPG"
						disabled={!canExport}
						onclick={() => exportAs('jpg')}
					>
						<svg
							width="14"
							height="14"
							viewBox="0 0 16 16"
							fill="none"
							stroke="currentColor"
							stroke-width="1.5"
						>
							<path d="M8 2v8m0 0L5 7.5M8 10l3-2.5M3 12h10" />
						</svg>
						<span class="export-format-label">JPG</span>
					</button>
					<button
						type="button"
						class="export-btn"
						aria-label="Download QR code as SVG"
						disabled={!canExport}
						onclick={() => exportAs('svg')}
					>
						<svg
							width="14"
							height="14"
							viewBox="0 0 16 16"
							fill="none"
							stroke="currentColor"
							stroke-width="1.5"
						>
							<path d="M8 2v8m0 0L5 7.5M8 10l3-2.5M3 12h10" />
						</svg>
						<span class="export-format-label">SVG</span>
					</button>
					<button
						type="button"
						class="export-btn export-btn-copy"
						aria-label={copyStatus === 'done'
							? 'Copied QR code to clipboard'
							: copyStatus === 'error'
								? 'Retry copying QR code to clipboard'
								: 'Copy QR code to clipboard'}
						disabled={!canExport}
						onclick={copyToClipboard}
					>
						<svg
							width="14"
							height="14"
							viewBox="0 0 14 14"
							fill="none"
							stroke="currentColor"
							stroke-width="1.5"
							aria-hidden="true"
						>
							<rect x="4" y="4" width="8" height="8" />
							<path d="M4 10H3a1 1 0 01-1-1V3a1 1 0 011-1h6a1 1 0 011 1v1" />
						</svg>
					</button>
			</div>
		</aside>
	</div>
</main>

<style>
	/* Page & Card shell */
	.page {
		height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem;
		overflow: hidden;
		background: var(--background);
		transition:
			background 0.3s ease,
			color 0.3s ease;
	}

	.card {
		display: grid;
		grid-template-columns: 1fr 1fr;
		grid-template-rows: auto 1fr;
		width: 100%;
		max-width: 900px;
		height: min(720px, calc(100vh - 1rem));
		border: 1px solid var(--border);
		overflow: hidden;
		transition: border-color 0.3s ease;
	}

	.card-header {
		grid-column: 1 / -1;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.25rem 2rem;
		border-bottom: 1px solid var(--border);
	}

	/* Left panel */
	.card-left {
		padding: 1.5rem 2rem;
		display: flex;
		flex-direction: column;
		gap: 0;
		overflow: hidden;
		min-height: 0;
	}

	.header-left {
		display: flex;
		align-items: baseline;
		gap: 0.125rem;
	}

	.logo {
		font-family: 'Oxanium', sans-serif;
		font-weight: 700;
		font-size: 1.25rem;
		color: var(--foreground);
	}

	.logo-domain {
		font-family: 'Oxanium', sans-serif;
		font-size: 0.75rem;
		color: var(--muted-foreground);
	}

	/* Theme dropdown in header */
	.theme-dropdown-trigger {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.5rem;
		background: var(--secondary);
		border: 1px solid var(--border);
		color: var(--foreground);
		cursor: pointer;
		font-size: 0.75rem;
		transition:
			background 0.2s ease,
			border-color 0.2s ease;
		width: 170px;
	}

	.theme-dropdown-trigger:hover {
		border-color: var(--ring);
	}

	.trigger-swatch {
		width: 10px;
		height: 10px;
		flex-shrink: 0;
	}

	.trigger-theme-name {
		flex: 1;
		font-weight: 500;
		white-space: nowrap;
	}

	.theme-dropdown-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		height: 100%;
		padding: 0 0.75rem;
		border: none;
		font-size: 0.8rem;
		text-align: left;
		cursor: pointer;
		transition:
			opacity 0.15s ease,
			filter 0.15s ease;
	}

	.theme-dropdown-item:hover {
		filter: brightness(1.3);
	}

	.theme-dropdown-item.selected {
		font-weight: 600;
		outline: 1px solid currentColor;
		outline-offset: -1px;
	}

	/* Accordion */
	.accordion-heading {
		margin: 0;
	}

	.accordion-trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 0.75rem 0;
		background: none;
		border: none;
		border-top: 1px solid var(--border);
		cursor: pointer;
		color: var(--foreground);
		text-align: left;
		transition: border-color 0.3s ease;
	}

	.accordion-heading:first-of-type .accordion-trigger {
		border-top: none;
	}

	.accordion-trigger:focus-visible,
	.toggle-item:focus-visible,
	.custom-checkbox:focus-visible,
	.ec-radio:focus-visible,
	.export-btn:focus-visible,
	.browse-btn:focus-visible,
	.capture-btn:focus-visible,
	.capture-menu-item:focus-visible,
	.stop-capture-btn:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
	}

	.accordion-title {
		font-family: 'Oxanium', sans-serif;
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--muted-foreground);
		transition: all 0.2s ease;
	}

	.accordion-title.large {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--foreground);
	}

	.accordion-chevron {
		transition: transform 0.2s ease;
		color: var(--muted-foreground);
		flex-shrink: 0;
	}

	.accordion-chevron.open {
		transform: rotate(180deg);
	}

	.accordion-panel {
		display: grid;
		grid-template-rows: 0fr;
		transition: grid-template-rows 0.3s ease;
		min-height: 0;
		flex: 0 0 auto;
		overflow: hidden;
	}

	.accordion-panel.open {
		grid-template-rows: 1fr;
		flex: 1 1 0px;
	}

	.accordion-content {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		overflow: hidden;
		min-height: 0;
		height: 0;
	}

	.accordion-panel.open .accordion-content {
		height: auto;
		padding-bottom: 0.75rem;
	}

	/* Sub-accordion (Payload / Appearance inside Generate) */
	.sub-accordion-heading {
		margin: 0;
	}

	.sub-accordion-trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 0.5rem 0;
		background: none;
		border: none;
		border-top: 1px solid var(--border);
		cursor: pointer;
		color: var(--foreground);
		text-align: left;
		transition: border-color 0.3s ease;
	}

	.sub-accordion-heading:first-of-type .sub-accordion-trigger {
		border-top: none;
	}

	.sub-accordion-trigger:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
	}

	.sub-accordion-title {
		font-family: 'Oxanium', sans-serif;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		color: var(--muted-foreground);
		transition: all 0.2s ease;
	}

	.sub-accordion-title.active {
		color: var(--foreground);
	}

	.sub-accordion-panel {
		display: grid;
		grid-template-rows: 0fr;
		transition: grid-template-rows 0.25s ease;
		min-height: 0;
		flex: 0 0 auto;
		overflow: hidden;
	}

	.sub-accordion-panel.open {
		grid-template-rows: 1fr;
		flex: 1 1 0px;
	}

	.sub-accordion-content {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		overflow: hidden;
		min-height: 0;
		height: 0;
	}

	.sub-accordion-panel.open .sub-accordion-content {
		height: auto;
		padding-bottom: 0.5rem;
	}

	/* Generate panel: form fills, settings stick to bottom */
	.generate-form {
		flex: 1 1 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-height: 0;
		overflow-y: auto;
	}

	.generate-form.over-capacity :is(.input, .textarea),
	.generate-form.over-capacity :is(.input, .textarea):focus {
		border-color: var(--destructive);
	}

	.byte-budget-inline {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0 0.75rem;
		min-width: 0;
	}

	.byte-budget-bar {
		display: block;
		flex: 1;
		height: 3px;
		background: var(--border);
		overflow: hidden;
	}

	.byte-budget-fill {
		display: block;
		height: 100%;
		background: var(--muted-foreground);
		transition: width 0.15s ease;
	}

	.byte-budget-inline.over .byte-budget-fill {
		background: var(--destructive);
	}

	.byte-budget-label {
		font-size: 0.6rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--muted-foreground);
		white-space: nowrap;
	}

	.byte-budget-inline.over .byte-budget-label {
		color: var(--destructive);
	}

	.byte-budget-sep {
		opacity: 0.4;
		margin: 0 0.1em;
	}

	.styling-form {
		flex: 1 1 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-height: 0;
		overflow-x: hidden;
		overflow-y: auto;
	}

	/* Type dropdown */
	.type-dropdown-trigger {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.625rem 0.75rem;
		background: var(--secondary);
		border: 1px solid var(--border);
		color: var(--foreground);
		cursor: pointer;
		font-size: 0.875rem;
		transition:
			background 0.2s ease,
			border-color 0.2s ease;
	}

	.type-dropdown-trigger:hover {
		border-color: var(--ring);
	}

	.type-dropdown-label {
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--muted-foreground);
	}

	.type-dropdown-value {
		flex: 1;
		font-weight: 500;
	}

	.type-dropdown-chevron {
		transition: transform 0.15s ease;
		color: var(--muted-foreground);
	}

	.type-dropdown-chevron.open {
		transform: rotate(180deg);
	}

	/* Inputs */
	.input {
		width: 100%;
		padding: 0.625rem 0.75rem;
		background: var(--secondary);
		border: 1px solid var(--border);
		color: var(--foreground);
		font-size: 0.875rem;
		font-family: inherit;
		outline: none;
		transition: border-color 0.15s ease;
	}

	.input:focus {
		border-color: var(--ring);
	}

	.input::placeholder {
		color: var(--muted-foreground);
	}

	.labeled-input {
		display: flex;
		align-items: stretch;
		border: 1px solid var(--border);
		background: var(--secondary);
		transition: border-color 0.15s ease;
	}

	.labeled-input:focus-within {
		border-color: var(--ring);
	}

	.generate-form.over-capacity .labeled-input,
	.generate-form.over-capacity .labeled-input:focus-within {
		border-color: var(--destructive);
	}

	.labeled-input-tag {
		display: flex;
		align-items: center;
		padding: 0 0.625rem;
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--muted-foreground);
		white-space: nowrap;
		flex-shrink: 0;
		border-right: 1px solid var(--border);
	}

	.labeled-input .input {
		border: none;
		background: transparent;
	}

	.labeled-input .input:focus {
		border-color: transparent;
	}

	.labeled-input .password-input-wrapper {
		flex: 1;
		min-width: 0;
	}

	.labeled-input .password-input-wrapper .input {
		border: none;
		background: transparent;
	}

	.password-input-wrapper {
		position: relative;
		display: flex;
		align-items: center;
	}

	.password-input {
		padding-right: 2.5rem;
	}

	.password-eye {
		position: absolute;
		right: 0.5rem;
		all: unset;
		cursor: pointer;
		color: var(--muted-foreground);
		display: flex;
		align-items: center;
		padding: 0.25rem;
	}

	.password-eye:hover {
		color: var(--foreground);
	}

	.textarea {
		resize: vertical;
		min-height: 60px;
		font-family: inherit;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.field-fill {
		flex: 1 1 0;
		min-height: 0;
	}

	.text-payload-input {
		flex: 1;
		resize: none;
		min-height: 0;
	}

	.fields {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.field-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}

	.field-label {
		margin: 0;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--muted-foreground);
	}

	/* Toggle group (replaces native select/checkbox) */
	.inline-options {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.toggle-group {
		display: flex;
		gap: 0;
		border: 1px solid var(--border);
	}

	.toggle-item {
		padding: 0.375rem 0.625rem;
		background: none;
		border: none;
		border-right: 1px solid var(--border);
		color: var(--muted-foreground);
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
		white-space: nowrap;
	}

	.toggle-item:last-child {
		border-right: none;
	}

	.toggle-item:hover {
		color: var(--foreground);
		background: var(--accent);
	}

	.toggle-item.active {
		background: var(--foreground);
		color: var(--background);
	}

	/* Custom checkbox */
	.custom-checkbox {
		width: 18px;
		height: 18px;
		border: 1px solid var(--border);
		background: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--foreground);
		padding: 0;
		flex-shrink: 0;
	}

	.custom-checkbox.checked {
		background: var(--foreground);
		color: var(--background);
	}

	.swatch-dot {
		width: 8px;
		height: 8px;
		flex-shrink: 0;
	}

	/* Settings row (size + style side by side) */
	.settings-row {
		display: flex;
		align-items: end;
		gap: 0.75rem;
		min-width: 0;
	}

	.settings-row-single > .mini-dropdown-wrapper {
		flex: 1 1 100%;
		max-width: 100%;
	}

	.mini-dropdown-wrapper {
		flex: 1;
		min-width: 0;
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.pixel-ratio-setting {
		flex: 0 0 calc((100% - 0.75rem) / 3);
		max-width: calc((100% - 0.75rem) / 3);
		min-width: 0;
	}

	.mini-dropdown-label-row {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.mini-dropdown-label {
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--muted-foreground);
		line-height: 1.2rem;
	}

	.mini-dropdown-trigger {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		width: 100%;
		height: 32px;
		padding: 0 0.625rem;
		background: var(--secondary);
		border: 1px solid var(--border);
		color: var(--foreground);
		cursor: pointer;
		font-size: 0.8rem;
		transition:
			background 0.2s ease,
			border-color 0.2s ease;
	}

	.mini-dropdown-trigger:hover {
		border-color: var(--ring);
	}

	.mini-dropdown-trigger:focus-within {
		border-color: var(--ring);
	}

	.mini-dropdown-value {
		color: var(--foreground);
		font-weight: 500;
	}

	.ratio-field {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		width: 100%;
	}

	.pixel-ratio-combobox {
		position: relative;
		flex: 1;
		min-width: 0;
		z-index: 30;
	}

	.ratio-trigger {
		min-width: 3rem;
		justify-content: flex-end;
	}

	.ratio-input-shell {
		justify-content: flex-end;
	}

	.pixel-ratio-input {
		width: 100%;
		min-width: 0;
		padding: 0;
		background: transparent;
		border: none;
		color: var(--foreground);
		font: inherit;
		font-weight: 500;
		text-align: right;
		appearance: textfield;
		outline: none;
	}

	.pixel-ratio-input:focus,
	.pixel-ratio-input:focus-visible {
		outline: none;
		box-shadow: none;
	}

	.pixel-ratio-input::-webkit-outer-spin-button,
	.pixel-ratio-input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.pixel-ratio-menu {
		position: absolute;
		top: calc(100% + 0.25rem);
		left: 0;
		z-index: 20;
		min-width: 100%;
		background: var(--popover);
		border: 1px solid var(--border);
		overflow: hidden;
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.18);
	}

	.pixel-ratio-option {
		display: block;
		width: 100%;
		padding: 0;
		background: none;
		border: none;
		color: var(--foreground);
		cursor: pointer;
		text-align: inherit;
	}

	.pixel-ratio-option:hover,
	.pixel-ratio-option.active {
		background: var(--accent);
	}

	.ratio-item {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		width: 100%;
		height: 100%;
		padding: 0 0.75rem;
		text-align: right;
	}

	.ratio-suffix {
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--muted-foreground);
	}

	.ec-radio-group {
		display: flex;
		gap: 0;
		height: 32px;
		border: 1px solid var(--border);
	}

	.ec-radio {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		background: var(--secondary);
		border: none;
		border-right: 1px solid var(--border);
		color: var(--muted-foreground);
		font-size: 0.8rem;
		font-weight: 500;
		cursor: pointer;
		transition:
			background 0.15s ease,
			color 0.15s ease;
	}

	.corner-shape-icon {
		width: 1rem;
		height: 1rem;
		overflow: visible;
	}

	.connection-mode-icon {
		width: 1rem;
		height: 1rem;
		display: block;
		overflow: visible;
	}

	.ec-radio:last-child {
		border-right: none;
	}

	.ec-radio:hover {
		color: var(--foreground);
	}

	.ec-radio.active {
		background: var(--accent);
		color: var(--foreground);
		font-weight: 600;
	}

	.ec-radio:disabled {
		cursor: not-allowed;
		opacity: 0.45;
	}

	.disabled-cap-trigger {
		display: flex;
		flex: 1;
		border-right: 1px solid var(--border);
		cursor: not-allowed;
	}

	.disabled-cap-trigger:last-child {
		border-right: none;
	}

	.disabled-cap-trigger .ec-radio {
		width: 100%;
		border-right: none;
	}

	.disabled-connection-trigger {
		display: flex;
		width: 100%;
		cursor: not-allowed;
	}

	.disabled-connection-trigger .ec-radio-group {
		width: 100%;
	}

	.ec-pct {
		font-size: 0.65rem;
		font-weight: 400;
		opacity: 0.6;
	}

	/* Slider field */
	.disabled-slider-trigger {
		width: 100%;
	}

	.info-tooltip-trigger {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.55rem;
		height: 1.2rem;
		padding: 0 0.2rem;
		border: none;
		border-radius: 999px;
		background: transparent;
		color: var(--muted-foreground);
		font-size: 0.6rem;
		font-weight: 700;
		line-height: 1;
		font-family: 'Oxanium', sans-serif;
		letter-spacing: 0.14em;
		cursor: help;
		transition:
			color 0.15s ease,
			background 0.15s ease;
	}

	.info-tooltip-trigger:hover,
	.info-tooltip-trigger:focus-visible {
		color: var(--foreground);
		background: color-mix(in srgb, var(--accent) 50%, transparent);
		outline: none;
	}

	:global(.dot-size-tooltip) {
		max-width: 18rem;
		padding: 0.625rem 0.75rem;
		font-size: 0.72rem;
		line-height: 1.45;
	}

	:global(.disabled-slider-tooltip) {
		max-width: 14rem;
		padding: 0.5rem 0.625rem;
		font-size: 0.68rem;
		line-height: 1.35;
	}

	:global(.disabled-cap-tooltip) {
		max-width: 14rem;
		padding: 0.5rem 0.625rem;
		font-size: 0.68rem;
		line-height: 1.35;
	}

	:global(.disabled-connection-tooltip) {
		max-width: 14rem;
		padding: 0.5rem 0.625rem;
		font-size: 0.68rem;
		line-height: 1.35;
	}

	/* Color field */
	.color-field {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		height: 32px;
		padding: 0 0.625rem;
		background: var(--secondary);
		border: 1px solid var(--border);
		transition: border-color 0.2s ease;
	}

	.color-field:hover,
	.color-field:focus-within {
		border-color: var(--ring);
	}

	.color-swatch-trigger {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		padding: 0;
		border: none;
		background: transparent;
		cursor: pointer;
		flex-shrink: 0;
	}

	.color-swatch {
		width: 1.25rem;
		height: 1.25rem;
		border: 1px solid var(--border);
		display: block;
	}

	.color-swatch-trigger:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
	}

	.color-picker-input {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		clip-path: inset(50%);
		border: 0;
		white-space: nowrap;
	}

	.color-text-input {
		flex: 1;
		min-width: 0;
		padding: 0;
		background: transparent;
		border: none;
		color: var(--foreground);
		font-size: 0.75rem;
		font-weight: 500;
		font-family: 'DM Sans Variable', monospace;
		text-transform: uppercase;
		outline: none;
	}

	.color-text-input::placeholder {
		color: var(--muted-foreground);
	}

	/* Export row */
	.error-correction-row {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-top: auto;
		border-top: 1px solid var(--border);
		padding-top: 0.625rem;
	}

	.export-row {
		display: flex;
		gap: 0.375rem;
		padding-top: 0.625rem;
	}

	.export-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		padding: 0.5rem;
		background: var(--background);
		color: var(--foreground);
		border: 1px solid var(--foreground);
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
		flex: 1;
		transition:
			background 0.15s ease,
			color 0.15s ease;
	}

	.export-format-label {
		letter-spacing: 0.02em;
	}

	.export-btn-copy {
		flex: 0 0 auto;
		gap: 0;
		padding: 0;
		aspect-ratio: 1;
		background: var(--foreground);
		color: var(--background);
		border: 1px solid var(--foreground);
	}

	.export-btn:hover:not(:disabled) {
		background: var(--foreground);
		color: var(--background);
	}

	.export-btn-copy:hover:not(:disabled) {
		background: var(--background);
		color: var(--foreground);
	}

	.export-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	/* Right panel (preview) */
	.card-right {
		display: flex;
		flex-direction: column;
		padding: 2rem;
		background: var(--secondary);
		border-left: 1px solid var(--border);
		min-height: 100%;
		transition:
			background 0.3s ease,
			border-color 0.3s ease;
	}

	.preview-area {
		position: relative;
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 0;
		overflow: hidden;
	}

	.preview-canvas {
		width: 100%;
		height: 100%;
		object-fit: contain;
		image-rendering: pixelated;
	}

	.preview-empty-icon {
		color: var(--muted-foreground);
		opacity: 0.2;
	}

	/* Reader section */
	.drop-zone {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 1.5rem;
		border: 1px dashed var(--border);
		text-align: center;
		transition: all 0.15s ease;
		cursor: default;
	}

	.drop-zone.dragging {
		border-color: var(--foreground);
		background: var(--accent);
	}

	.drop-icon {
		color: var(--muted-foreground);
		opacity: 0.5;
	}

	.drop-text {
		margin: 0;
		font-size: 0.85rem;
		color: var(--muted-foreground);
	}

	.drop-hint {
		font-size: 0.75rem;
		color: var(--muted-foreground);
		opacity: 0.6;
	}

	.drop-hint kbd {
		padding: 0.125rem 0.375rem;
		border: 1px solid var(--border);
		font-family: 'DM Sans Variable', monospace;
		font-size: 0.65rem;
		background: var(--secondary);
	}

	.browse-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border);
		background: var(--secondary);
		color: var(--foreground);
		font-size: 0.8rem;
		cursor: pointer;
		transition: background 0.12s ease;
	}

	.browse-btn:hover {
		background: var(--accent);
	}

	.browse-capture-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	/* Capture */
	.capture-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.capture-row {
		position: relative;
	}

	.capture-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: var(--secondary);
		border: 1px solid var(--border);
		color: var(--foreground);
		font-size: 0.8rem;
		cursor: pointer;
		transition: background 0.12s ease;
	}

	.capture-btn:hover {
		background: var(--accent);
	}

	.capture-menu {
		position: absolute;
		top: 100%;
		left: 0;
		z-index: 50;
		background: var(--popover);
		border: 1px solid var(--border);
		min-width: 140px;
		animation: dropdown-in 0.15s ease;
	}

	.capture-menu-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.5rem 0.75rem;
		background: none;
		border: none;
		border-bottom: 1px solid var(--border);
		color: var(--foreground);
		font-size: 0.8rem;
		cursor: pointer;
		text-align: left;
	}

	.capture-menu-item:last-child {
		border-bottom: none;
	}

	.capture-menu-item:hover {
		background: var(--accent);
	}

	.webcam-preview {
		position: relative;
	}

	.webcam-video {
		width: 100%;
		border: 1px solid var(--border);
	}

	.capture-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		font-size: 0.8rem;
		color: var(--muted-foreground);
		border: 1px solid var(--border);
	}

	.capture-dot {
		width: 8px;
		height: 8px;
		background: #ef4444;
		animation: pulse 1s infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.3;
		}
	}

	.stop-capture-btn {
		padding: 0.25rem 0.5rem;
		background: var(--destructive);
		color: white;
		border: none;
		font-size: 0.75rem;
		cursor: pointer;
		margin-left: auto;
	}

	.reader-error {
		font-size: 0.8rem;
		color: var(--destructive);
	}

	/* Mobile: header first, form above preview */
	@media (max-width: 640px) {
		.page {
			height: auto;
			min-height: 100vh;
			overflow: visible;
		}

		.card {
			grid-template-columns: 1fr;
			max-width: 100%;
			height: auto;
		}

		.card-header {
			order: -2;
		}

		.card-right {
			border-left: none;
			border-bottom: 1px solid var(--border);
			min-height: 200px;
			padding: 1.5rem;
		}

		.card-left {
			max-height: none;
			padding: 1.5rem;
		}

		.accordion-panel.open {
			flex: 0 0 auto;
			min-height: 320px;
		}

		.generate-form {
			flex: 1 1 0;
		}

		.styling-form {
			flex: 0 0 auto;
		}

		.settings-row {
			flex-direction: column;
			gap: 0.75rem;
		}

		.pixel-ratio-setting {
			flex-basis: auto;
			max-width: 100%;
		}
	}
</style>
