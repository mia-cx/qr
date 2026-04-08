<script lang="ts">
	import { page } from '$app/state';
	import { deLocalizeUrl } from '$lib/paraglide/runtime';
	import { qrState } from '$lib/qr/state.svelte';
	import {
		themes,
		getTheme,
		setTheme,
		getQrColors,
		themeStore,
		applyDocumentTheme
	} from '$lib/themes';
	import { generateQRSvg, generateQRCanvas } from '$lib/qr/generate';
	import {
		readQRFromFile,
		readQRFromClipboard,
		readQRFromImageData,
		createScreenCapture,
		type QRReadResult
	} from '$lib/qr/reader';
	import { payloadLabels, decodePayload, type PayloadType } from '$lib/qr/payloads';
	import type { ErrorCorrectionLevel } from '$lib/qr/generate';
	import { onDestroy, onMount } from 'svelte';
	import Dropdown from '$lib/components/Dropdown.svelte';
	import DateRangePicker from '$lib/components/DateRangePicker.svelte';
	import ReaderResult from '$lib/components/ReaderResult.svelte';
	import { getStudioSectionForPath } from '$lib/routes/studio';

	// --- State ---
	let activeSection = $state<'generate' | 'read'>('generate');
	let exportCanvas: HTMLCanvasElement;

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
	let webcamVideo = $state<HTMLVideoElement | undefined>(undefined);
	let webcamScanFrame = $state<number | null>(null);

	const payloadTypeItems = (Object.entries(payloadLabels) as [PayloadType, string][]).map(
		([value, label]) => ({ value, label })
	);
	const pixelSizeItems = [1, 2, 3, 4, 6, 8, 10, 16, 32].map((s) => ({
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

	function getCurrentQrOptions() {
		return {
			data: qrState.encodedData,
			errorCorrection: qrState.errorCorrection,
			pixelSize: qrState.pixelSize,
			moduleStyle: qrState.moduleStyle,
			fgColor: qrState.fgColor,
			bgColor: qrState.bgColor,
			logo: qrState.logo,
			frameText: qrState.frameText
		};
	}

	const svgOutput = $derived(qrState.encodedData ? generateQRSvg(getCurrentQrOptions()) : '');

	let previewSrc = $state('');
	const previewOptions = $derived(
		qrState.encodedData
			? {
					...getCurrentQrOptions(),
					pixelSize: 1
				}
			: null
	);

	$effect(() => {
		if (previewOptions) {
			const c = document.createElement('canvas');
			generateQRCanvas(c, previewOptions);
			previewSrc = c.toDataURL('image/png');
		} else {
			previewSrc = '';
		}
	});

	// --- Auto-detection ---
	const urlPattern = /^(https?:\/\/|www\.)/i;
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
		if (urlPattern.test(value)) {
			targetType = 'url';
		} else if (phonePattern.test(value) && value.replace(/\D/g, '').length >= 7) {
			targetType = 'phone';
		} else {
			targetType = 'text';
		}

		// Switch type and sync value to all simple fields so switching back preserves it
		qrState.payloadType = targetType;
		qrState.setPayloadField('url', 'url', value);
		qrState.setPayloadField('text', 'text', value);
		qrState.setPayloadField('phone', 'number', value);
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
		if (!svgOutput) {
			return 'QR preview will appear after you enter content.';
		}

		return `${payloadLabels[qrState.payloadType]} QR preview ready. ${qrState.encodedData.length} characters encoded.`;
	});

	// --- Theme ---
	let currentTheme = $state(themeStore.get());
	const routeSection = $derived(getStudioSectionForPath(deLocalizeUrl(page.url).pathname));

	onMount(() =>
		themeStore.subscribe((id) => {
			currentTheme = id;
			applyDocumentTheme(id);
			const { fg, bg } = getQrColors();
			qrState.applyThemeColors(fg, bg);
		})
	);

	$effect(() => {
		if (routeSection) {
			activeSection = routeSection;
		}
	});

	function switchTheme(id: string) {
		setTheme(id);
	}

	onDestroy(() => {
		stopCapture();
	});

	// --- Export ---
	function exportAs(fmt: 'svg' | 'png' | 'jpg') {
		if (!svgOutput) return;
		const qrOptions = getCurrentQrOptions();

		if (fmt === 'svg') {
			const blob = new Blob([svgOutput], { type: 'image/svg+xml' });
			download(blob, 'qr.svg');
		} else {
			if (!exportCanvas) return;
			generateQRCanvas(exportCanvas, qrOptions);
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

	function download(blob: Blob, filename: string) {
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
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

	async function handlePasteButton() {
		resetReaderState();
		applyReaderResult(await readQRFromClipboard());
	}

	function loadResultIntoGenerator() {
		if (!readerResult) return;

		const decoded = decodePayload(readerResult);
		qrState.payloadType = decoded.type;
		qrState.payloads[decoded.type] = decoded.fields as never;
		activeSection = 'generate';
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
		try {
			webcamStream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: 'environment' }
			});
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
		qrState.errorCorrection = moveRadioSelection(errorCorrectionValues, current, direction);
	}

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
					<section class="generate-form" aria-label="QR generation form">
						<!-- Type Selector -->
						<Dropdown
							items={payloadTypeItems}
							value={qrState.payloadType}
							label="QR content type"
							onselect={(v) => {
								qrState.payloadType = v as PayloadType;
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
							<div class="field">
								<input
									class="input"
									type="text"
									aria-label={getPrimaryLabel()}
									placeholder={getPrimaryPlaceholder()}
									value={getPrimaryValue()}
									oninput={(e) => handlePrimaryInput(e.currentTarget.value)}
								/>
							</div>
						{:else}
							<!-- Multi-field forms -->
							<div class="fields">
								{#if qrState.payloadType === 'wifi'}
									<input
										class="input"
										type="text"
										aria-label="Wi-Fi network name"
										placeholder="Network name (SSID)"
										value={qrState.payloads.wifi.ssid}
										oninput={(e) => qrState.setPayloadField('wifi', 'ssid', e.currentTarget.value)}
									/>
									<div class="password-input-wrapper">
										<input
											class="input password-input"
											type={showWifiPassword ? 'text' : 'password'}
											aria-label="Wi-Fi password"
											placeholder="Password"
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
									<input
										class="input"
										type="tel"
										aria-label="SMS phone number"
										placeholder="Phone number"
										value={qrState.payloads.sms.number}
										oninput={(e) => qrState.setPayloadField('sms', 'number', e.currentTarget.value)}
									/>
									<textarea
										class="input textarea"
										aria-label="SMS message"
										placeholder="Message"
										rows="2"
										value={qrState.payloads.sms.message}
										oninput={(e) =>
											qrState.setPayloadField('sms', 'message', e.currentTarget.value)}
									></textarea>
								{:else if qrState.payloadType === 'email'}
									<input
										class="input"
										type="email"
										aria-label="Recipient email"
										placeholder="Recipient email"
										value={qrState.payloads.email.to}
										oninput={(e) => qrState.setPayloadField('email', 'to', e.currentTarget.value)}
									/>
									<input
										class="input"
										type="text"
										aria-label="Email subject"
										placeholder="Subject"
										value={qrState.payloads.email.subject}
										oninput={(e) =>
											qrState.setPayloadField('email', 'subject', e.currentTarget.value)}
									/>
									<textarea
										class="input textarea"
										aria-label="Email body"
										placeholder="Body"
										rows="2"
										value={qrState.payloads.email.body}
										oninput={(e) => qrState.setPayloadField('email', 'body', e.currentTarget.value)}
									></textarea>
								{:else if qrState.payloadType === 'vcard'}
									<div class="field-row">
										<input
											class="input"
											type="text"
											aria-label="vCard first name"
											placeholder="First name"
											value={qrState.payloads.vcard.firstName}
											oninput={(e) =>
												qrState.setPayloadField('vcard', 'firstName', e.currentTarget.value)}
										/>
										<input
											class="input"
											type="text"
											aria-label="vCard last name"
											placeholder="Last name"
											value={qrState.payloads.vcard.lastName}
											oninput={(e) =>
												qrState.setPayloadField('vcard', 'lastName', e.currentTarget.value)}
										/>
									</div>
									<input
										class="input"
										type="tel"
										aria-label="vCard phone"
										placeholder="Phone"
										value={qrState.payloads.vcard.phone}
										oninput={(e) =>
											qrState.setPayloadField('vcard', 'phone', e.currentTarget.value)}
									/>
									<input
										class="input"
										type="email"
										aria-label="vCard email"
										placeholder="Email"
										value={qrState.payloads.vcard.email}
										oninput={(e) =>
											qrState.setPayloadField('vcard', 'email', e.currentTarget.value)}
									/>
									<input
										class="input"
										type="text"
										aria-label="vCard organization"
										placeholder="Organization"
										value={qrState.payloads.vcard.org}
										oninput={(e) => qrState.setPayloadField('vcard', 'org', e.currentTarget.value)}
									/>
									<input
										class="input"
										type="text"
										aria-label="vCard title"
										placeholder="Title"
										value={qrState.payloads.vcard.title}
										oninput={(e) =>
											qrState.setPayloadField('vcard', 'title', e.currentTarget.value)}
									/>
									<input
										class="input"
										type="url"
										aria-label="vCard website"
										placeholder="Website"
										value={qrState.payloads.vcard.url}
										oninput={(e) => qrState.setPayloadField('vcard', 'url', e.currentTarget.value)}
									/>
									<input
										class="input"
										type="text"
										aria-label="vCard address"
										placeholder="Address"
										value={qrState.payloads.vcard.address}
										oninput={(e) =>
											qrState.setPayloadField('vcard', 'address', e.currentTarget.value)}
									/>
								{:else if qrState.payloadType === 'calendar'}
									<input
										class="input"
										type="text"
										aria-label="Calendar event title"
										placeholder="Event title"
										value={qrState.payloads.calendar.title}
										oninput={(e) =>
											qrState.setPayloadField('calendar', 'title', e.currentTarget.value)}
									/>
									<input
										class="input"
										type="text"
										aria-label="Calendar location"
										placeholder="Location"
										value={qrState.payloads.calendar.location}
										oninput={(e) =>
											qrState.setPayloadField('calendar', 'location', e.currentTarget.value)}
									/>
									<textarea
										class="input textarea"
										aria-label="Calendar description"
										placeholder="Description"
										rows="2"
										value={qrState.payloads.calendar.description}
										oninput={(e) =>
											qrState.setPayloadField('calendar', 'description', e.currentTarget.value)}
									></textarea>
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
										<input
											class="input"
											type="text"
											aria-label="Latitude"
											placeholder="Latitude"
											value={qrState.payloads.geo.latitude}
											oninput={(e) =>
												qrState.setPayloadField('geo', 'latitude', e.currentTarget.value)}
										/>
										<input
											class="input"
											type="text"
											aria-label="Longitude"
											placeholder="Longitude"
											value={qrState.payloads.geo.longitude}
											oninput={(e) =>
												qrState.setPayloadField('geo', 'longitude', e.currentTarget.value)}
										/>
									</div>
								{:else if qrState.payloadType === 'mecard'}
									<input
										class="input"
										type="text"
										aria-label="MeCard name"
										placeholder="Name"
										value={qrState.payloads.mecard.name}
										oninput={(e) =>
											qrState.setPayloadField('mecard', 'name', e.currentTarget.value)}
									/>
									<input
										class="input"
										type="tel"
										aria-label="MeCard phone"
										placeholder="Phone"
										value={qrState.payloads.mecard.phone}
										oninput={(e) =>
											qrState.setPayloadField('mecard', 'phone', e.currentTarget.value)}
									/>
									<input
										class="input"
										type="email"
										aria-label="MeCard email"
										placeholder="Email"
										value={qrState.payloads.mecard.email}
										oninput={(e) =>
											qrState.setPayloadField('mecard', 'email', e.currentTarget.value)}
									/>
									<input
										class="input"
										type="url"
										aria-label="MeCard website"
										placeholder="Website"
										value={qrState.payloads.mecard.url}
										oninput={(e) => qrState.setPayloadField('mecard', 'url', e.currentTarget.value)}
									/>
									<input
										class="input"
										type="text"
										aria-label="MeCard address"
										placeholder="Address"
										value={qrState.payloads.mecard.address}
										oninput={(e) =>
											qrState.setPayloadField('mecard', 'address', e.currentTarget.value)}
									/>
									<textarea
										class="input textarea"
										aria-label="MeCard note"
										placeholder="Note"
										rows="2"
										value={qrState.payloads.mecard.note}
										oninput={(e) =>
											qrState.setPayloadField('mecard', 'note', e.currentTarget.value)}
									></textarea>
								{/if}
							</div>
						{/if}
					</section>
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
					<!-- Drag & Drop Zone -->
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

					<!-- Result -->
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
			<div class="preview-area" aria-hidden="true">
				{#if previewSrc}
					<img src={previewSrc} alt="QR code preview" class="preview-img" />
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

			<div class="card-right-footer">
				<div class="settings-section">
					<div class="settings-row">
						<div class="mini-dropdown-wrapper" style="flex: 0 0 auto;">
							<span class="mini-dropdown-label">Pixel Ratio</span>
							<div class="ratio-field">
								<Dropdown
									items={pixelSizeItems}
									value={String(qrState.pixelSize)}
									label="Pixel ratio"
									onselect={(v) => {
										qrState.pixelSize = Number(v);
									}}
								>
									{#snippet trigger({ value })}
										<span class="mini-dropdown-trigger ratio-trigger">
											<span class="mini-dropdown-value">{value}</span>
										</span>
									{/snippet}
									{#snippet children({ label })}
										<span class="ratio-item">{label}</span>
									{/snippet}
								</Dropdown>
								<span class="ratio-suffix">&nbsp;:&nbsp;1</span>
							</div>
						</div>

						<div class="mini-dropdown-wrapper">
							<span class="mini-dropdown-label">Error Correction</span>
							<div class="ec-radio-group" role="radiogroup" aria-label="Error correction level">
								{#each ecLevels as level (level.value)}
									<button
										type="button"
										class="ec-radio"
										class:active={qrState.errorCorrection === level.value}
										role="radio"
										aria-checked={qrState.errorCorrection === level.value}
										onkeydown={(e) => handleErrorCorrectionKeydown(e, level.value)}
										onclick={() => {
											qrState.errorCorrection = level.value;
										}}
									>
										{level.label} <span class="ec-pct">{level.pct}</span>
									</button>
								{/each}
							</div>
						</div>
					</div>
				</div>

				<div class="export-row" role="group" aria-label="Download QR code">
					<button
						type="button"
						class="export-btn"
						aria-label="Download QR code as SVG"
						disabled={!svgOutput}
						onclick={() => exportAs('svg')}
					>
						<svg
							width="14"
							height="14"
							viewBox="0 0 16 16"
							fill="none"
							stroke="currentColor"
							stroke-width="1.5"><path d="M8 2v8m0 0L5 7.5M8 10l3-2.5M3 12h10" /></svg
						>
						SVG
					</button>
					<button
						type="button"
						class="export-btn"
						aria-label="Download QR code as PNG"
						disabled={!svgOutput}
						onclick={() => exportAs('png')}
					>
						<svg
							width="14"
							height="14"
							viewBox="0 0 16 16"
							fill="none"
							stroke="currentColor"
							stroke-width="1.5"><path d="M8 2v8m0 0L5 7.5M8 10l3-2.5M3 12h10" /></svg
						>
						PNG
					</button>
					<button
						type="button"
						class="export-btn"
						aria-label="Download QR code as JPG"
						disabled={!svgOutput}
						onclick={() => exportAs('jpg')}
					>
						<svg
							width="14"
							height="14"
							viewBox="0 0 16 16"
							fill="none"
							stroke="currentColor"
							stroke-width="1.5"><path d="M8 2v8m0 0L5 7.5M8 10l3-2.5M3 12h10" /></svg
						>
						JPG
					</button>
				</div>
			</div>
		</aside>
	</div>
</main>

<style>
	/* Page & Card shell */
	.page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
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
		height: 720px;
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
	}

	.accordion-panel.open .accordion-content {
		padding-bottom: 0.75rem;
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

	/* Settings */
	.settings-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.swatch-dot {
		width: 8px;
		height: 8px;
		flex-shrink: 0;
	}

	/* Settings row (size + style side by side) */
	.settings-row {
		display: flex;
		gap: 1.25rem;
	}

	.mini-dropdown-wrapper {
		flex: 1;
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.mini-dropdown-label {
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--muted-foreground);
	}

	.mini-dropdown-trigger {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		width: 100%;
		padding: 0.5rem 0.625rem;
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

	.mini-dropdown-value {
		color: var(--foreground);
		font-weight: 500;
	}

	.ratio-field {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.ratio-trigger {
		min-width: 3rem;
		justify-content: flex-end;
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
		border: 1px solid var(--border);
	}

	.ec-radio {
		flex: 1;
		padding: 0.5rem 0;
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

	.ec-pct {
		font-size: 0.65rem;
		font-weight: 400;
		opacity: 0.6;
	}

	/* Export row (three buttons side by side) */
	.export-row {
		display: flex;
		gap: 0.375rem;
	}

	.export-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		flex: 1;
		padding: 0.5rem;
		background: var(--foreground);
		color: var(--background);
		border: none;
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
		transition: opacity 0.15s ease;
	}

	.export-btn:hover {
		opacity: 0.9;
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
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 0;
		overflow: hidden;
	}

	.preview-img {
		image-rendering: pixelated;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.card-right-footer {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border);
		margin-top: 0.75rem;
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

	/* Mobile: preview on top, form below */
	@media (max-width: 640px) {
		.card {
			grid-template-columns: 1fr;
			max-width: 100%;
			height: auto;
		}

		.card-right {
			order: -1;
			border-left: none;
			border-bottom: 1px solid var(--border);
			min-height: 200px;
			padding: 1.5rem;
		}

		.card-left {
			max-height: none;
			padding: 1.5rem;
		}
	}
</style>
