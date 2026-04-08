<script lang="ts">
	import { qrState } from '$lib/qr/state.svelte';
	import { themes, getTheme, applyTheme } from '$lib/themes';
	import { generateQRSvg, generateQRCanvas } from '$lib/qr/generate';
	import { readQRFromFile, readQRFromClipboard, readQRFromImageData, createScreenCapture } from '$lib/qr/reader';
	import { payloadLabels, type PayloadType } from '$lib/qr/payloads';
	import type { ErrorCorrectionLevel, ModuleStyle } from '$lib/qr/generate';
	import { onMount } from 'svelte';

	let activeTab = $state<'generate' | 'read'>('generate');
	let readerResult = $state('');
	let readerError = $state('');
	let isCapturing = $state(false);
	let captureController = $state<{ start: () => Promise<void>; stop: () => void } | null>(null);
	let fileInputEl: HTMLInputElement;
	let exportCanvas: HTMLCanvasElement;

	const payloadTypes = Object.entries(payloadLabels) as [PayloadType, string][];
	const errorLevels: { value: ErrorCorrectionLevel; label: string; desc: string }[] = [
		{ value: 'L', label: 'L', desc: '~7% recovery' },
		{ value: 'M', label: 'M', desc: '~15% recovery' },
		{ value: 'Q', label: 'Q', desc: '~25% recovery' },
		{ value: 'H', label: 'H', desc: '~30% recovery' }
	];
	const moduleStyles: { value: ModuleStyle; label: string }[] = [
		{ value: 'square', label: 'Square' },
		{ value: 'rounded', label: 'Rounded' },
		{ value: 'dots', label: 'Dots' },
		{ value: 'diamond', label: 'Diamond' }
	];
	const pixelSizes = [3, 4, 5, 6, 8, 10, 12, 16];

	const svgOutput = $derived(generateQRSvg(qrState.qrOptions));

	onMount(() => {
		const theme = getTheme(qrState.themeId);
		applyTheme(theme);
		qrState.applyThemeColors(theme.colors.qrFg, theme.colors.qrBg);
	});

	function switchTheme(id: string) {
		qrState.themeId = id;
		const theme = getTheme(id);
		applyTheme(theme);
		qrState.applyThemeColors(theme.colors.qrFg, theme.colors.qrBg);
	}

	function handleLogoUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			qrState.logo = reader.result as string;
		};
		reader.readAsDataURL(file);
	}

	function exportSVG() {
		const blob = new Blob([svgOutput], { type: 'image/svg+xml' });
		downloadBlob(blob, 'qr.svg');
	}

	function exportPNG() {
		if (!exportCanvas) return;
		generateQRCanvas(exportCanvas, qrState.qrOptions);
		exportCanvas.toBlob((blob) => {
			if (blob) downloadBlob(blob, 'qr.png');
		});
	}

	function downloadBlob(blob: Blob, filename: string) {
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	async function handleReaderFile(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		const result = await readQRFromFile(file);
		readerResult = result.data;
		readerError = result.error ?? '';
	}

	async function handlePaste() {
		const result = await readQRFromClipboard();
		readerResult = result.data;
		readerError = result.error ?? '';
	}

	function toggleScreenCapture() {
		if (isCapturing && captureController) {
			captureController.stop();
			captureController = null;
			isCapturing = false;
			return;
		}

		const controller = createScreenCapture(
			(imageData: ImageData) => {
				const result = readQRFromImageData(imageData);
				if (result.success) {
					readerResult = result.data;
					readerError = '';
					controller.stop();
					captureController = null;
					isCapturing = false;
				}
			},
			(err: string) => {
				readerError = err;
				isCapturing = false;
			}
		);
		captureController = controller;
		isCapturing = true;
		controller.start();
	}

	async function handleGlobalPaste(e: ClipboardEvent) {
		if (activeTab !== 'read') return;
		const items = e.clipboardData?.items;
		if (!items) return;
		for (const item of items) {
			if (item.type.startsWith('image/')) {
				e.preventDefault();
				const file = item.getAsFile();
				if (file) {
					const result = await readQRFromFile(file);
					readerResult = result.data;
					readerError = result.error ?? '';
				}
				return;
			}
		}
	}
</script>

<svelte:window onpaste={handleGlobalPaste} />
<svelte:head>
	<title>qr.mia.cx</title>
	<meta name="description" content="QR code generator and reader" />
</svelte:head>

<canvas bind:this={exportCanvas} class="hidden"></canvas>

<div class="flex min-h-screen flex-col lg:flex-row">
	<!-- Controls Panel -->
	<aside class="controls-panel flex w-full flex-col overflow-y-auto border-r lg:w-[420px]" style="border-color: var(--c-border); background: var(--c-bg-secondary);">
		<!-- Header -->
		<header class="flex items-center gap-3 border-b px-5 py-4" style="border-color: var(--c-border);">
			<div class="grid-icon" style="color: var(--c-accent);">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
					<rect x="2" y="2" width="7" height="7" rx="1" fill="currentColor"/>
					<rect x="15" y="2" width="7" height="7" rx="1" fill="currentColor"/>
					<rect x="2" y="15" width="7" height="7" rx="1" fill="currentColor"/>
					<rect x="11" y="11" width="2" height="2" fill="currentColor"/>
					<rect x="15" y="11" width="2" height="2" fill="currentColor"/>
					<rect x="11" y="15" width="2" height="2" fill="currentColor"/>
					<rect x="15" y="15" width="2" height="2" fill="currentColor"/>
					<rect x="19" y="15" width="2" height="2" fill="currentColor"/>
					<rect x="15" y="19" width="2" height="2" fill="currentColor"/>
					<rect x="19" y="19" width="2" height="2" fill="currentColor"/>
					<rect x="11" y="19" width="2" height="2" fill="currentColor"/>
				</svg>
			</div>
			<h1 class="text-lg font-semibold" style="font-family: 'Outfit', sans-serif;">qr.mia.cx</h1>
		</header>

		<!-- Tab Switcher -->
		<div class="flex border-b" style="border-color: var(--c-border);">
			<button
				class="flex-1 px-4 py-2.5 text-sm font-medium transition-colors"
				style="background: {activeTab === 'generate' ? 'var(--c-bg-tertiary)' : 'transparent'}; color: {activeTab === 'generate' ? 'var(--c-fg)' : 'var(--c-fg-muted)'};"
				onclick={() => activeTab = 'generate'}
			>Generate</button>
			<button
				class="flex-1 px-4 py-2.5 text-sm font-medium transition-colors"
				style="background: {activeTab === 'read' ? 'var(--c-bg-tertiary)' : 'transparent'}; color: {activeTab === 'read' ? 'var(--c-fg)' : 'var(--c-fg-muted)'};"
				onclick={() => activeTab = 'read'}
			>Read</button>
		</div>

		{#if activeTab === 'generate'}
			<div class="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
				<!-- Payload Type -->
				<section>
					<span class="section-label">Type</span>
					<div class="grid grid-cols-5 gap-1.5">
						{#each payloadTypes as [value, label]}
							<button
								class="rounded px-2 py-1.5 text-xs font-medium transition-colors"
								style="background: {qrState.payloadType === value ? 'var(--c-accent)' : 'var(--c-bg-tertiary)'}; color: {qrState.payloadType === value ? 'var(--c-accent-fg)' : 'var(--c-fg-secondary)'};"
								onclick={() => qrState.payloadType = value}
							>{label}</button>
						{/each}
					</div>
				</section>

				<!-- Payload Fields -->
				<section>
					<span class="section-label">Content</span>
					{#if qrState.payloadType === 'url'}
						<input type="url" placeholder="https://example.com" class="field-input" value={qrState.payloads.url.url} oninput={(e) => qrState.setPayloadField('url', 'url', e.currentTarget.value)} />
					{:else if qrState.payloadType === 'text'}
						<textarea placeholder="Your text here..." class="field-input min-h-[80px] resize-y" value={qrState.payloads.text.text} oninput={(e) => qrState.setPayloadField('text', 'text', e.currentTarget.value)}></textarea>
					{:else if qrState.payloadType === 'wifi'}
						<div class="flex flex-col gap-2">
							<input type="text" placeholder="Network name (SSID)" class="field-input" value={qrState.payloads.wifi.ssid} oninput={(e) => qrState.setPayloadField('wifi', 'ssid', e.currentTarget.value)} />
							<input type="password" placeholder="Password" class="field-input" value={qrState.payloads.wifi.password} oninput={(e) => qrState.setPayloadField('wifi', 'password', e.currentTarget.value)} />
							<select class="field-input" value={qrState.payloads.wifi.encryption} onchange={(e) => qrState.setPayloadField('wifi', 'encryption', e.currentTarget.value)}>
								<option value="WPA">WPA/WPA2</option>
								<option value="WEP">WEP</option>
								<option value="nopass">No encryption</option>
							</select>
							<label class="flex items-center gap-2 text-sm" style="color: var(--c-fg-secondary);">
								<input type="checkbox" checked={qrState.payloads.wifi.hidden} onchange={(e) => qrState.setPayloadField('wifi', 'hidden', e.currentTarget.checked)} />
								Hidden network
							</label>
						</div>
					{:else if qrState.payloadType === 'phone'}
						<input type="tel" placeholder="+1 234 567 8900" class="field-input" value={qrState.payloads.phone.number} oninput={(e) => qrState.setPayloadField('phone', 'number', e.currentTarget.value)} />
					{:else if qrState.payloadType === 'sms'}
						<div class="flex flex-col gap-2">
							<input type="tel" placeholder="Phone number" class="field-input" value={qrState.payloads.sms.number} oninput={(e) => qrState.setPayloadField('sms', 'number', e.currentTarget.value)} />
							<textarea placeholder="Message" class="field-input min-h-[60px] resize-y" value={qrState.payloads.sms.message} oninput={(e) => qrState.setPayloadField('sms', 'message', e.currentTarget.value)}></textarea>
						</div>
					{:else if qrState.payloadType === 'email'}
						<div class="flex flex-col gap-2">
							<input type="email" placeholder="recipient@example.com" class="field-input" value={qrState.payloads.email.to} oninput={(e) => qrState.setPayloadField('email', 'to', e.currentTarget.value)} />
							<input type="text" placeholder="Subject" class="field-input" value={qrState.payloads.email.subject} oninput={(e) => qrState.setPayloadField('email', 'subject', e.currentTarget.value)} />
							<textarea placeholder="Body" class="field-input min-h-[60px] resize-y" value={qrState.payloads.email.body} oninput={(e) => qrState.setPayloadField('email', 'body', e.currentTarget.value)}></textarea>
						</div>
					{:else if qrState.payloadType === 'vcard'}
						<div class="flex flex-col gap-2">
							<div class="grid grid-cols-2 gap-2">
								<input type="text" placeholder="First name" class="field-input" value={qrState.payloads.vcard.firstName} oninput={(e) => qrState.setPayloadField('vcard', 'firstName', e.currentTarget.value)} />
								<input type="text" placeholder="Last name" class="field-input" value={qrState.payloads.vcard.lastName} oninput={(e) => qrState.setPayloadField('vcard', 'lastName', e.currentTarget.value)} />
							</div>
							<input type="tel" placeholder="Phone" class="field-input" value={qrState.payloads.vcard.phone} oninput={(e) => qrState.setPayloadField('vcard', 'phone', e.currentTarget.value)} />
							<input type="email" placeholder="Email" class="field-input" value={qrState.payloads.vcard.email} oninput={(e) => qrState.setPayloadField('vcard', 'email', e.currentTarget.value)} />
							<input type="text" placeholder="Organization" class="field-input" value={qrState.payloads.vcard.org} oninput={(e) => qrState.setPayloadField('vcard', 'org', e.currentTarget.value)} />
							<input type="text" placeholder="Title" class="field-input" value={qrState.payloads.vcard.title} oninput={(e) => qrState.setPayloadField('vcard', 'title', e.currentTarget.value)} />
							<input type="url" placeholder="Website" class="field-input" value={qrState.payloads.vcard.url} oninput={(e) => qrState.setPayloadField('vcard', 'url', e.currentTarget.value)} />
							<input type="text" placeholder="Address" class="field-input" value={qrState.payloads.vcard.address} oninput={(e) => qrState.setPayloadField('vcard', 'address', e.currentTarget.value)} />
						</div>
					{:else if qrState.payloadType === 'calendar'}
						<div class="flex flex-col gap-2">
							<input type="text" placeholder="Event title" class="field-input" value={qrState.payloads.calendar.title} oninput={(e) => qrState.setPayloadField('calendar', 'title', e.currentTarget.value)} />
							<input type="text" placeholder="Location" class="field-input" value={qrState.payloads.calendar.location} oninput={(e) => qrState.setPayloadField('calendar', 'location', e.currentTarget.value)} />
							<textarea placeholder="Description" class="field-input min-h-[60px] resize-y" value={qrState.payloads.calendar.description} oninput={(e) => qrState.setPayloadField('calendar', 'description', e.currentTarget.value)}></textarea>
							<label class="text-xs" style="color: var(--c-fg-muted);">Start
								<input type="datetime-local" class="field-input" value={qrState.payloads.calendar.start} oninput={(e) => qrState.setPayloadField('calendar', 'start', e.currentTarget.value)} />
							</label>
							<label class="text-xs" style="color: var(--c-fg-muted);">End
								<input type="datetime-local" class="field-input" value={qrState.payloads.calendar.end} oninput={(e) => qrState.setPayloadField('calendar', 'end', e.currentTarget.value)} />
							</label>
						</div>
					{:else if qrState.payloadType === 'geo'}
						<div class="grid grid-cols-2 gap-2">
							<input type="text" placeholder="Latitude" class="field-input" value={qrState.payloads.geo.latitude} oninput={(e) => qrState.setPayloadField('geo', 'latitude', e.currentTarget.value)} />
							<input type="text" placeholder="Longitude" class="field-input" value={qrState.payloads.geo.longitude} oninput={(e) => qrState.setPayloadField('geo', 'longitude', e.currentTarget.value)} />
						</div>
					{:else if qrState.payloadType === 'mecard'}
						<div class="flex flex-col gap-2">
							<input type="text" placeholder="Name" class="field-input" value={qrState.payloads.mecard.name} oninput={(e) => qrState.setPayloadField('mecard', 'name', e.currentTarget.value)} />
							<input type="tel" placeholder="Phone" class="field-input" value={qrState.payloads.mecard.phone} oninput={(e) => qrState.setPayloadField('mecard', 'phone', e.currentTarget.value)} />
							<input type="email" placeholder="Email" class="field-input" value={qrState.payloads.mecard.email} oninput={(e) => qrState.setPayloadField('mecard', 'email', e.currentTarget.value)} />
							<input type="url" placeholder="URL" class="field-input" value={qrState.payloads.mecard.url} oninput={(e) => qrState.setPayloadField('mecard', 'url', e.currentTarget.value)} />
							<input type="text" placeholder="Address" class="field-input" value={qrState.payloads.mecard.address} oninput={(e) => qrState.setPayloadField('mecard', 'address', e.currentTarget.value)} />
							<textarea placeholder="Note" class="field-input min-h-[50px] resize-y" value={qrState.payloads.mecard.note} oninput={(e) => qrState.setPayloadField('mecard', 'note', e.currentTarget.value)}></textarea>
						</div>
					{/if}
				</section>

				<!-- Error Correction -->
				<section>
					<span class="section-label">Error Correction</span>
					<div class="grid grid-cols-4 gap-1.5">
						{#each errorLevels as level}
							<button
								class="flex flex-col items-center rounded px-2 py-2 transition-colors"
								style="background: {qrState.errorCorrection === level.value ? 'var(--c-accent)' : 'var(--c-bg-tertiary)'}; color: {qrState.errorCorrection === level.value ? 'var(--c-accent-fg)' : 'var(--c-fg-secondary)'};"
								onclick={() => qrState.errorCorrection = level.value}
							>
								<span class="text-sm font-semibold">{level.label}</span>
								<span class="text-[10px] opacity-70">{level.desc}</span>
							</button>
						{/each}
					</div>
				</section>

				<!-- Module Style -->
				<section>
					<span class="section-label">Module Style</span>
					<div class="grid grid-cols-4 gap-1.5">
						{#each moduleStyles as style}
							<button
								class="rounded px-2 py-1.5 text-xs font-medium transition-colors"
								style="background: {qrState.moduleStyle === style.value ? 'var(--c-accent)' : 'var(--c-bg-tertiary)'}; color: {qrState.moduleStyle === style.value ? 'var(--c-accent-fg)' : 'var(--c-fg-secondary)'};"
								onclick={() => qrState.moduleStyle = style.value}
							>{style.label}</button>
						{/each}
					</div>
				</section>

				<!-- Pixel Size -->
				<section>
					<span class="section-label">Pixel Size <span class="font-mono text-xs opacity-60">{qrState.pixelSize}px</span></span>
					<div class="grid grid-cols-4 gap-1.5">
						{#each pixelSizes as size}
							<button
								class="rounded px-2 py-1.5 text-xs font-medium transition-colors"
								style="background: {qrState.pixelSize === size ? 'var(--c-accent)' : 'var(--c-bg-tertiary)'}; color: {qrState.pixelSize === size ? 'var(--c-accent-fg)' : 'var(--c-fg-secondary)'};"
								onclick={() => qrState.pixelSize = size}
							>{size}:1</button>
						{/each}
					</div>
				</section>

				<!-- Colors -->
				<section>
					<span class="section-label">Colors</span>
					<div class="grid grid-cols-2 gap-3">
						<label class="flex items-center gap-2">
							<input type="color" value={qrState.fgColor} oninput={(e) => qrState.fgColor = e.currentTarget.value} class="color-input" />
							<span class="text-xs" style="color: var(--c-fg-secondary);">Foreground</span>
						</label>
						<label class="flex items-center gap-2">
							<input type="color" value={qrState.bgColor} oninput={(e) => qrState.bgColor = e.currentTarget.value} class="color-input" />
							<span class="text-xs" style="color: var(--c-fg-secondary);">Background</span>
						</label>
					</div>
				</section>

				<!-- Logo -->
				<section>
					<span class="section-label">Logo</span>
					<div class="flex items-center gap-2">
						<button
							class="rounded px-3 py-1.5 text-xs font-medium transition-colors"
							style="background: var(--c-bg-tertiary); color: var(--c-fg-secondary);"
							onclick={() => fileInputEl.click()}
						>Upload Logo</button>
						{#if qrState.logo}
							<button
								class="rounded px-3 py-1.5 text-xs font-medium transition-colors"
								style="background: var(--c-error); color: var(--c-accent-fg);"
								onclick={() => qrState.logo = undefined}
							>Remove</button>
						{/if}
					</div>
					<input bind:this={fileInputEl} type="file" accept="image/*" class="hidden" onchange={handleLogoUpload} />
					{#if qrState.logo && qrState.errorCorrection !== 'H' && qrState.errorCorrection !== 'Q'}
						<p class="mt-1 text-xs" style="color: var(--c-error);">Tip: Use Q or H error correction with logos</p>
					{/if}
				</section>

				<!-- Frame Text -->
				<section>
					<span class="section-label">Frame Label</span>
					<input type="text" placeholder="SCAN ME" class="field-input" value={qrState.frameText} oninput={(e) => qrState.frameText = e.currentTarget.value} />
				</section>

				<!-- Theme Selector -->
				<section>
					<span class="section-label">Theme</span>
					<div class="grid grid-cols-2 gap-1.5">
						{#each themes as theme}
							<button
								class="flex items-center gap-2 rounded px-2.5 py-2 text-left transition-colors"
								style="background: {qrState.themeId === theme.id ? 'var(--c-accent)' : 'var(--c-bg-tertiary)'}; color: {qrState.themeId === theme.id ? 'var(--c-accent-fg)' : 'var(--c-fg-secondary)'};"
								onclick={() => switchTheme(theme.id)}
							>
								<span class="flex gap-0.5">
									<span class="inline-block h-3 w-3 rounded-full" style="background: {theme.colors.bg}; border: 1px solid {theme.colors.border};"></span>
									<span class="inline-block h-3 w-3 rounded-full" style="background: {theme.colors.accent};"></span>
									<span class="inline-block h-3 w-3 rounded-full" style="background: {theme.colors.fg};"></span>
								</span>
								<span class="truncate text-xs">{theme.name}</span>
							</button>
						{/each}
					</div>
				</section>

				<!-- Export -->
				<section class="mt-auto border-t pt-4" style="border-color: var(--c-border);">
					<span class="section-label">Export</span>
					<div class="grid grid-cols-2 gap-2">
						<button
							class="rounded py-2 text-sm font-semibold transition-colors"
							style="background: var(--c-accent); color: var(--c-accent-fg);"
							onclick={exportSVG}
							disabled={!svgOutput}
						>SVG</button>
						<button
							class="rounded py-2 text-sm font-semibold transition-colors"
							style="background: var(--c-accent); color: var(--c-accent-fg);"
							onclick={exportPNG}
							disabled={!svgOutput}
						>PNG</button>
					</div>
				</section>
			</div>
		{:else}
			<!-- Reader Tab -->
			<div class="flex flex-1 flex-col gap-4 p-5">
				<section>
					<span class="section-label">Read a QR Code</span>
					<div class="flex flex-col gap-2">
						<button
							class="rounded py-2 text-sm font-medium transition-colors"
							style="background: var(--c-bg-tertiary); color: var(--c-fg-secondary);"
							onclick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.onchange = (e) => handleReaderFile(e); input.click(); }}
						>Upload Image</button>
						<button
							class="rounded py-2 text-sm font-medium transition-colors"
							style="background: var(--c-bg-tertiary); color: var(--c-fg-secondary);"
							onclick={handlePaste}
						>Paste from Clipboard (or Cmd+V)</button>
						<button
							class="rounded py-2 text-sm font-medium transition-colors"
							style="background: {isCapturing ? 'var(--c-error)' : 'var(--c-bg-tertiary)'}; color: {isCapturing ? 'var(--c-accent-fg)' : 'var(--c-fg-secondary)'};"
							onclick={toggleScreenCapture}
						>{isCapturing ? 'Stop Capture' : 'Screen Capture'}</button>
					</div>
				</section>

				{#if readerResult}
					<section>
						<span class="section-label">Result</span>
						<div class="rounded p-3" style="background: var(--c-bg-tertiary);">
							<pre class="whitespace-pre-wrap break-all text-sm" style="color: var(--c-fg); font-family: 'JetBrains Mono', monospace;">{readerResult}</pre>
						</div>
						<button
							class="mt-2 rounded px-3 py-1.5 text-xs font-medium transition-colors"
							style="background: var(--c-accent); color: var(--c-accent-fg);"
							onclick={() => navigator.clipboard.writeText(readerResult)}
						>Copy to Clipboard</button>
					</section>
				{/if}

				{#if readerError}
					<p class="text-sm" style="color: var(--c-error);">{readerError}</p>
				{/if}
			</div>
		{/if}
	</aside>

	<!-- Preview Panel -->
	<main class="flex flex-1 flex-col items-center justify-center p-8" style="background: var(--c-bg);">
		{#if activeTab === 'generate'}
			{#if svgOutput}
				<div class="qr-preview" style="transition: opacity 0.2s ease;">
					{@html svgOutput}
				</div>
				<p class="mt-4 font-mono text-xs" style="color: var(--c-fg-muted);">
					{qrState.encodedData.length} chars &middot; {qrState.errorCorrection} &middot; {qrState.pixelSize}:1
				</p>
			{:else}
				<div class="flex flex-col items-center gap-3" style="color: var(--c-fg-muted);">
					<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
						<rect x="2" y="2" width="7" height="7" rx="1"/>
						<rect x="15" y="2" width="7" height="7" rx="1"/>
						<rect x="2" y="15" width="7" height="7" rx="1"/>
						<rect x="11" y="11" width="2" height="2"/>
						<rect x="15" y="15" width="7" height="7" rx="1"/>
					</svg>
					<p class="text-sm">Enter content to generate a QR code</p>
				</div>
			{/if}
		{:else}
			<div class="flex flex-col items-center gap-3" style="color: var(--c-fg-muted);">
				<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14"/>
					<rect x="3" y="3" width="18" height="18" rx="2"/>
				</svg>
				<p class="text-sm">Upload, paste, or capture a QR code</p>
			</div>
		{/if}
	</main>
</div>

<style>
	:global(.section-label) {
		display: block;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--c-fg-muted);
		margin-bottom: 0.5rem;
		font-family: 'JetBrains Mono', monospace;
	}

	.field-input {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border-radius: 0.375rem;
		border: 1px solid var(--c-border);
		background: var(--c-bg);
		color: var(--c-fg);
		outline: none;
		transition: border-color 0.15s ease;
	}

	.field-input:focus {
		border-color: var(--c-border-focus);
	}

	.field-input::placeholder {
		color: var(--c-fg-muted);
	}

	.color-input {
		width: 28px;
		height: 28px;
		border: 1px solid var(--c-border);
		border-radius: 0.25rem;
		cursor: pointer;
		background: none;
		padding: 0;
	}

	.color-input::-webkit-color-swatch-wrapper {
		padding: 2px;
	}

	.color-input::-webkit-color-swatch {
		border: none;
		border-radius: 2px;
	}

	.qr-preview :global(svg) {
		max-width: 100%;
		max-height: 70vh;
		height: auto;
		filter: drop-shadow(0 4px 24px rgba(0, 0, 0, 0.2));
	}

	.controls-panel {
		max-height: 100vh;
	}

	@media (max-width: 1023px) {
		.controls-panel {
			max-height: none;
		}
	}
</style>
