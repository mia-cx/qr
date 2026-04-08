<script lang="ts">
	import { qrState } from '$lib/qr/state.svelte';
	import { themes, getTheme, applyTheme } from '$lib/themes';
	import { generateQRSvg, generateQRCanvas } from '$lib/qr/generate';
	import { readQRFromFile, readQRFromClipboard, readQRFromImageData, createScreenCapture } from '$lib/qr/reader';
	import { payloadLabels, type PayloadType } from '$lib/qr/payloads';
	import type { ErrorCorrectionLevel, ModuleStyle } from '$lib/qr/generate';
	import { onMount } from 'svelte';

	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as Select from '$lib/components/ui/select';
	import { Separator } from '$lib/components/ui/separator';
	import { Badge } from '$lib/components/ui/badge';

	let activeTab = $state<string>('generate');
	let readerResult = $state('');
	let readerError = $state('');
	let isCapturing = $state(false);
	let captureController = $state<{ start: () => Promise<void>; stop: () => void } | null>(null);
	let fileInputEl: HTMLInputElement;
	let exportCanvas: HTMLCanvasElement;
	let showCustomize = $state(false);
	let showThemes = $state(false);

	const payloadTypes = Object.entries(payloadLabels) as [PayloadType, string][];
	const errorLevels: { value: ErrorCorrectionLevel; label: string; desc: string }[] = [
		{ value: 'L', label: 'L', desc: '7%' },
		{ value: 'M', label: 'M', desc: '15%' },
		{ value: 'Q', label: 'Q', desc: '25%' },
		{ value: 'H', label: 'H', desc: '30%' }
	];
	const moduleStyles: { value: ModuleStyle; label: string }[] = [
		{ value: 'square', label: '■' },
		{ value: 'rounded', label: '▢' },
		{ value: 'dots', label: '●' },
		{ value: 'diamond', label: '◆' }
	];
	const pixelSizes = [1, 2, 3, 4, 6, 8, 10, 16, 32];

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
<input bind:this={fileInputEl} type="file" accept="image/*" class="hidden" onchange={handleLogoUpload} />

<div class="studio">
	<!-- Header -->
	<header class="studio-header">
		<div class="flex items-center gap-2">
			<span class="header-mark">QR</span>
			<span class="text-muted-foreground font-mono text-xs tracking-widest">.mia.cx</span>
		</div>

		<!-- Theme dots -->
		<div class="flex items-center gap-1">
			{#each themes.slice(0, 6) as theme}
				<button
					class="theme-dot"
					class:active={qrState.themeId === theme.id}
					style="background: {theme.colors.accent};"
					title={theme.name}
					onclick={() => switchTheme(theme.id)}
				></button>
			{/each}
			<button
				class="text-muted-foreground hover:text-foreground ml-1 text-xs transition-colors"
				onclick={() => showThemes = !showThemes}
			>{showThemes ? '−' : '+'}</button>
		</div>
	</header>

	{#if showThemes}
		<div class="theme-tray">
			{#each themes as theme}
				<button
					class="theme-chip"
					class:active={qrState.themeId === theme.id}
					onclick={() => switchTheme(theme.id)}
				>
					<span class="theme-chip-swatch" style="background: {theme.colors.accent};"></span>
					<span class="theme-chip-name">{theme.name}</span>
				</button>
			{/each}
		</div>
	{/if}

	<!-- Main content -->
	<Tabs.Root bind:value={activeTab} class="studio-body">
		<Tabs.List class="studio-tabs">
			<Tabs.Trigger value="generate">Generate</Tabs.Trigger>
			<Tabs.Trigger value="read">Read</Tabs.Trigger>
		</Tabs.List>

		<!-- GENERATE TAB -->
		<Tabs.Content value="generate" class="studio-content">
			<!-- QR Preview -->
			<div class="preview-stage">
				{#if svgOutput}
					<div class="preview-qr">
						{@html svgOutput}
					</div>
					<div class="preview-meta">
						<Badge variant="secondary" class="font-mono text-[10px]">{qrState.errorCorrection}</Badge>
						<Badge variant="secondary" class="font-mono text-[10px]">{qrState.pixelSize}:1</Badge>
						<Badge variant="secondary" class="font-mono text-[10px]">{qrState.encodedData.length} chars</Badge>
					</div>
				{:else}
					<div class="preview-empty">
						<div class="preview-empty-icon">
							<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.75" class="text-muted-foreground/40">
								<rect x="2" y="2" width="7" height="7" rx="1"/>
								<rect x="15" y="2" width="7" height="7" rx="1"/>
								<rect x="2" y="15" width="7" height="7" rx="1"/>
								<rect x="11" y="11" width="2" height="2"/>
								<rect x="15" y="15" width="7" height="7" rx="1"/>
							</svg>
						</div>
						<p class="text-muted-foreground text-sm">type something below</p>
					</div>
				{/if}
			</div>

			<!-- Quick toolbar -->
			<div class="toolbar">
				<!-- Error Correction -->
				<div class="toolbar-group">
					<span class="toolbar-label">EC</span>
					<div class="toolbar-pills">
						{#each errorLevels as level}
							<button
								class="pill"
								class:active={qrState.errorCorrection === level.value}
								title="{level.desc} recovery"
								onclick={() => qrState.errorCorrection = level.value}
							>{level.label}</button>
						{/each}
					</div>
				</div>

				<Separator orientation="vertical" class="!h-6" />

				<!-- Module style -->
				<div class="toolbar-group">
					<span class="toolbar-label">Style</span>
					<div class="toolbar-pills">
						{#each moduleStyles as style}
							<button
								class="pill"
								class:active={qrState.moduleStyle === style.value}
								title={style.label}
								onclick={() => qrState.moduleStyle = style.value}
							>{style.label}</button>
						{/each}
					</div>
				</div>

				<Separator orientation="vertical" class="!h-6" />

				<!-- Pixel size -->
				<div class="toolbar-group">
					<span class="toolbar-label">Size</span>
					<Select.Root type="single" value={String(qrState.pixelSize)} onValueChange={(v) => { if (v) qrState.pixelSize = Number(v); }}>
						<Select.Trigger class="h-7 w-[72px] font-mono text-xs">
							{qrState.pixelSize}:1
						</Select.Trigger>
						<Select.Content>
							{#each pixelSizes as size}
								<Select.Item value={String(size)} label="{size}:1" />
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
			</div>

			<!-- Content type & input -->
			<Card.Root class="studio-card">
				<Card.Header class="pb-3">
					<Card.Title class="text-xs font-semibold tracking-wider uppercase text-muted-foreground">Content</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-3">
					<!-- Type selector -->
					<div class="type-grid">
						{#each payloadTypes as [value, label]}
							<button
								class="type-btn"
								class:active={qrState.payloadType === value}
								onclick={() => qrState.payloadType = value}
							>{label}</button>
						{/each}
					</div>

					<Separator />

					<!-- Dynamic form fields -->
					<div class="fields">
						{#if qrState.payloadType === 'url'}
							<Input type="url" placeholder="https://example.com" value={qrState.payloads.url.url} oninput={(e) => qrState.setPayloadField('url', 'url', e.currentTarget.value)} />
						{:else if qrState.payloadType === 'text'}
							<Textarea placeholder="Your text here..." class="min-h-[80px] resize-y" value={qrState.payloads.text.text} oninput={(e) => qrState.setPayloadField('text', 'text', e.currentTarget.value)} />
						{:else if qrState.payloadType === 'wifi'}
							<Input type="text" placeholder="Network name (SSID)" value={qrState.payloads.wifi.ssid} oninput={(e) => qrState.setPayloadField('wifi', 'ssid', e.currentTarget.value)} />
							<Input type="password" placeholder="Password" value={qrState.payloads.wifi.password} oninput={(e) => qrState.setPayloadField('wifi', 'password', e.currentTarget.value)} />
							<Select.Root type="single" value={qrState.payloads.wifi.encryption} onValueChange={(v) => { if (v) qrState.setPayloadField('wifi', 'encryption', v); }}>
								<Select.Trigger class="w-full">
									{qrState.payloads.wifi.encryption === 'WPA' ? 'WPA/WPA2' : qrState.payloads.wifi.encryption === 'WEP' ? 'WEP' : 'No encryption'}
								</Select.Trigger>
								<Select.Content>
									<Select.Item value="WPA" label="WPA/WPA2" />
									<Select.Item value="WEP" label="WEP" />
									<Select.Item value="nopass" label="No encryption" />
								</Select.Content>
							</Select.Root>
							<label class="text-muted-foreground flex items-center gap-2 text-sm">
								<input type="checkbox" checked={qrState.payloads.wifi.hidden} onchange={(e) => qrState.setPayloadField('wifi', 'hidden', e.currentTarget.checked)} class="accent-primary" />
								Hidden network
							</label>
						{:else if qrState.payloadType === 'phone'}
							<Input type="tel" placeholder="+1 234 567 8900" value={qrState.payloads.phone.number} oninput={(e) => qrState.setPayloadField('phone', 'number', e.currentTarget.value)} />
						{:else if qrState.payloadType === 'sms'}
							<Input type="tel" placeholder="Phone number" value={qrState.payloads.sms.number} oninput={(e) => qrState.setPayloadField('sms', 'number', e.currentTarget.value)} />
							<Textarea placeholder="Message" class="min-h-[60px] resize-y" value={qrState.payloads.sms.message} oninput={(e) => qrState.setPayloadField('sms', 'message', e.currentTarget.value)} />
						{:else if qrState.payloadType === 'email'}
							<Input type="email" placeholder="recipient@example.com" value={qrState.payloads.email.to} oninput={(e) => qrState.setPayloadField('email', 'to', e.currentTarget.value)} />
							<Input type="text" placeholder="Subject" value={qrState.payloads.email.subject} oninput={(e) => qrState.setPayloadField('email', 'subject', e.currentTarget.value)} />
							<Textarea placeholder="Body" class="min-h-[60px] resize-y" value={qrState.payloads.email.body} oninput={(e) => qrState.setPayloadField('email', 'body', e.currentTarget.value)} />
						{:else if qrState.payloadType === 'vcard'}
							<div class="grid grid-cols-2 gap-2">
								<Input type="text" placeholder="First name" value={qrState.payloads.vcard.firstName} oninput={(e) => qrState.setPayloadField('vcard', 'firstName', e.currentTarget.value)} />
								<Input type="text" placeholder="Last name" value={qrState.payloads.vcard.lastName} oninput={(e) => qrState.setPayloadField('vcard', 'lastName', e.currentTarget.value)} />
							</div>
							<Input type="tel" placeholder="Phone" value={qrState.payloads.vcard.phone} oninput={(e) => qrState.setPayloadField('vcard', 'phone', e.currentTarget.value)} />
							<Input type="email" placeholder="Email" value={qrState.payloads.vcard.email} oninput={(e) => qrState.setPayloadField('vcard', 'email', e.currentTarget.value)} />
							<Input type="text" placeholder="Organization" value={qrState.payloads.vcard.org} oninput={(e) => qrState.setPayloadField('vcard', 'org', e.currentTarget.value)} />
							<Input type="text" placeholder="Title" value={qrState.payloads.vcard.title} oninput={(e) => qrState.setPayloadField('vcard', 'title', e.currentTarget.value)} />
							<Input type="url" placeholder="Website" value={qrState.payloads.vcard.url} oninput={(e) => qrState.setPayloadField('vcard', 'url', e.currentTarget.value)} />
							<Input type="text" placeholder="Address" value={qrState.payloads.vcard.address} oninput={(e) => qrState.setPayloadField('vcard', 'address', e.currentTarget.value)} />
						{:else if qrState.payloadType === 'calendar'}
							<Input type="text" placeholder="Event title" value={qrState.payloads.calendar.title} oninput={(e) => qrState.setPayloadField('calendar', 'title', e.currentTarget.value)} />
							<Input type="text" placeholder="Location" value={qrState.payloads.calendar.location} oninput={(e) => qrState.setPayloadField('calendar', 'location', e.currentTarget.value)} />
							<Textarea placeholder="Description" class="min-h-[60px] resize-y" value={qrState.payloads.calendar.description} oninput={(e) => qrState.setPayloadField('calendar', 'description', e.currentTarget.value)} />
							<div class="grid grid-cols-2 gap-2">
								<label class="text-muted-foreground space-y-1 text-xs">
									<span>Start</span>
									<Input type="datetime-local" value={qrState.payloads.calendar.start} oninput={(e) => qrState.setPayloadField('calendar', 'start', e.currentTarget.value)} />
								</label>
								<label class="text-muted-foreground space-y-1 text-xs">
									<span>End</span>
									<Input type="datetime-local" value={qrState.payloads.calendar.end} oninput={(e) => qrState.setPayloadField('calendar', 'end', e.currentTarget.value)} />
								</label>
							</div>
						{:else if qrState.payloadType === 'geo'}
							<div class="grid grid-cols-2 gap-2">
								<Input type="text" placeholder="Latitude" value={qrState.payloads.geo.latitude} oninput={(e) => qrState.setPayloadField('geo', 'latitude', e.currentTarget.value)} />
								<Input type="text" placeholder="Longitude" value={qrState.payloads.geo.longitude} oninput={(e) => qrState.setPayloadField('geo', 'longitude', e.currentTarget.value)} />
							</div>
						{:else if qrState.payloadType === 'mecard'}
							<Input type="text" placeholder="Name" value={qrState.payloads.mecard.name} oninput={(e) => qrState.setPayloadField('mecard', 'name', e.currentTarget.value)} />
							<Input type="tel" placeholder="Phone" value={qrState.payloads.mecard.phone} oninput={(e) => qrState.setPayloadField('mecard', 'phone', e.currentTarget.value)} />
							<Input type="email" placeholder="Email" value={qrState.payloads.mecard.email} oninput={(e) => qrState.setPayloadField('mecard', 'email', e.currentTarget.value)} />
							<Input type="url" placeholder="URL" value={qrState.payloads.mecard.url} oninput={(e) => qrState.setPayloadField('mecard', 'url', e.currentTarget.value)} />
							<Input type="text" placeholder="Address" value={qrState.payloads.mecard.address} oninput={(e) => qrState.setPayloadField('mecard', 'address', e.currentTarget.value)} />
							<Textarea placeholder="Note" class="min-h-[50px] resize-y" value={qrState.payloads.mecard.note} oninput={(e) => qrState.setPayloadField('mecard', 'note', e.currentTarget.value)} />
						{/if}
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Customize (collapsible) -->
			<button class="collapse-trigger" onclick={() => showCustomize = !showCustomize}>
				<span class="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Customize</span>
				<svg class="collapse-chevron" class:open={showCustomize} width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 6l3 3 3-3"/></svg>
			</button>

			{#if showCustomize}
				<Card.Root class="studio-card">
					<Card.Content class="space-y-4 pt-4">
						<!-- Colors -->
						<div class="flex items-center gap-4">
							<label class="color-pair">
								<input type="color" value={qrState.fgColor} oninput={(e) => qrState.fgColor = e.currentTarget.value} class="color-swatch" />
								<span class="text-muted-foreground text-xs">FG</span>
							</label>
							<label class="color-pair">
								<input type="color" value={qrState.bgColor} oninput={(e) => qrState.bgColor = e.currentTarget.value} class="color-swatch" />
								<span class="text-muted-foreground text-xs">BG</span>
							</label>

							<Separator orientation="vertical" class="!h-8" />

							<!-- Logo -->
							<div class="flex items-center gap-2">
								<Button variant="outline" size="sm" onclick={() => fileInputEl.click()}>
									{qrState.logo ? 'Change logo' : 'Add logo'}
								</Button>
								{#if qrState.logo}
									<Button variant="ghost" size="sm" onclick={() => qrState.logo = undefined}>✕</Button>
								{/if}
							</div>
						</div>
						{#if qrState.logo && qrState.errorCorrection !== 'H' && qrState.errorCorrection !== 'Q'}
							<p class="text-destructive text-xs">Use Q or H error correction with logos for best results</p>
						{/if}

						<!-- Frame text -->
						<Input type="text" placeholder="Frame label (e.g. SCAN ME)" value={qrState.frameText} oninput={(e) => qrState.frameText = e.currentTarget.value} />
					</Card.Content>
				</Card.Root>
			{/if}

			<!-- Export -->
			<div class="export-bar">
				<Button variant="outline" class="flex-1" onclick={exportSVG} disabled={!svgOutput}>
					<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 2v7m0 0L4.5 6.5M7 9l2.5-2.5M2 11h10"/></svg>
					SVG
				</Button>
				<Button variant="outline" class="flex-1" onclick={exportPNG} disabled={!svgOutput}>
					<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 2v7m0 0L4.5 6.5M7 9l2.5-2.5M2 11h10"/></svg>
					PNG
				</Button>
			</div>
		</Tabs.Content>

		<!-- READ TAB -->
		<Tabs.Content value="read" class="studio-content">
			<Card.Root class="studio-card">
				<Card.Header>
					<Card.Title class="text-xs font-semibold tracking-wider uppercase text-muted-foreground">Scan a QR Code</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-2">
					<Button variant="outline" class="w-full justify-start" onclick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.onchange = (e) => handleReaderFile(e); input.click(); }}>
						<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 9v2a1 1 0 001 1h8a1 1 0 001-1V9M7 2v7M4.5 4.5L7 2l2.5 2.5"/></svg>
						Upload image
					</Button>
					<Button variant="outline" class="w-full justify-start" onclick={handlePaste}>
						<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="1" width="8" height="3" rx="1"/><rect x="2" y="3" width="10" height="10" rx="1"/></svg>
						Paste from clipboard
						<kbd class="bg-muted text-muted-foreground ml-auto rounded px-1.5 py-0.5 font-mono text-[10px]">⌘V</kbd>
					</Button>
					<Button variant={isCapturing ? "destructive" : "outline"} class="w-full justify-start" onclick={toggleScreenCapture}>
						<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="3" width="12" height="9" rx="1"/><circle cx="7" cy="7.5" r="2"/></svg>
						{isCapturing ? 'Stop capture' : 'Screen capture'}
					</Button>
				</Card.Content>
			</Card.Root>

			{#if readerResult}
				<Card.Root class="studio-card">
					<Card.Header>
						<Card.Title class="text-xs font-semibold tracking-wider uppercase text-muted-foreground">Result</Card.Title>
					</Card.Header>
					<Card.Content>
						<pre class="bg-muted text-foreground overflow-x-auto whitespace-pre-wrap break-all rounded-md p-3 font-mono text-sm">{readerResult}</pre>
						<Button variant="secondary" size="sm" class="mt-2" onclick={() => navigator.clipboard.writeText(readerResult)}>
							Copy
						</Button>
					</Card.Content>
				</Card.Root>
			{/if}

			{#if readerError}
				<p class="text-destructive text-sm">{readerError}</p>
			{/if}
		</Tabs.Content>
	</Tabs.Root>
</div>

<style>
	.studio {
		min-height: 100vh;
		max-width: 720px;
		margin: 0 auto;
		padding: 1.5rem 1.25rem 4rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.studio-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.25rem 0;
	}

	.header-mark {
		font-family: 'JetBrains Mono', monospace;
		font-weight: 800;
		font-size: 1.25rem;
		letter-spacing: -0.03em;
		color: var(--foreground);
	}

	.theme-dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: 2px solid transparent;
		cursor: pointer;
		transition: all 0.15s ease;
		opacity: 0.6;
	}

	.theme-dot:hover {
		opacity: 1;
		transform: scale(1.2);
	}

	.theme-dot.active {
		opacity: 1;
		border-color: var(--foreground);
		transform: scale(1.3);
	}

	.theme-tray {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		padding: 0.5rem 0;
	}

	.theme-chip {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem 0.625rem 0.25rem 0.375rem;
		border-radius: 9999px;
		border: 1px solid var(--border);
		background: transparent;
		color: var(--muted-foreground);
		font-size: 0.7rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.theme-chip:hover {
		border-color: var(--foreground);
		color: var(--foreground);
	}

	.theme-chip.active {
		background: var(--accent);
		color: var(--accent-foreground);
		border-color: var(--accent);
	}

	.theme-chip-swatch {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.theme-chip-name {
		font-family: 'JetBrains Mono', monospace;
	}

	:global(.studio-body) {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	:global(.studio-tabs) {
		align-self: center;
	}

	:global(.studio-content) {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	:global(.studio-card) {
		background: var(--card);
		border-color: var(--border);
	}

	.preview-stage {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2.5rem 1rem;
		border-radius: var(--radius-lg);
		background:
			radial-gradient(circle at 1px 1px, var(--border) 0.5px, transparent 0.5px);
		background-size: 16px 16px;
		border: 1px solid var(--border);
		min-height: 280px;
		position: relative;
	}

	.preview-qr :global(svg) {
		max-width: 100%;
		max-height: 50vh;
		height: auto;
		filter: drop-shadow(0 2px 12px rgba(0, 0, 0, 0.15));
	}

	.preview-meta {
		display: flex;
		gap: 0.375rem;
		margin-top: 1rem;
	}

	.preview-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}

	.preview-empty-icon {
		opacity: 0.3;
	}

	/* Toolbar */
	.toolbar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0.75rem;
		border-radius: var(--radius-lg);
		border: 1px solid var(--border);
		background: var(--card);
		overflow-x: auto;
		flex-wrap: wrap;
		justify-content: center;
	}

	.toolbar-group {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.toolbar-label {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.625rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted-foreground);
		white-space: nowrap;
	}

	.toolbar-pills {
		display: flex;
		gap: 2px;
	}

	.pill {
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-md);
		border: 1px solid transparent;
		background: transparent;
		color: var(--muted-foreground);
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.pill:hover {
		background: var(--muted);
		color: var(--foreground);
	}

	.pill.active {
		background: var(--primary);
		color: var(--primary-foreground);
		border-color: var(--primary);
	}

	/* Type grid */
	.type-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.type-btn {
		padding: 0.3rem 0.6rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
		background: transparent;
		color: var(--muted-foreground);
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.type-btn:hover {
		border-color: var(--foreground);
		color: var(--foreground);
	}

	.type-btn.active {
		background: var(--primary);
		color: var(--primary-foreground);
		border-color: var(--primary);
	}

	.fields {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	/* Collapse trigger */
	.collapse-trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0;
		background: none;
		border: none;
		cursor: pointer;
		width: 100%;
	}

	.collapse-chevron {
		color: var(--muted-foreground);
		transition: transform 0.15s ease;
	}

	.collapse-chevron.open {
		transform: rotate(180deg);
	}

	/* Color controls */
	.color-pair {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		cursor: pointer;
	}

	.color-swatch {
		width: 28px;
		height: 28px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		cursor: pointer;
		padding: 0;
		background: none;
	}

	.color-swatch::-webkit-color-swatch-wrapper {
		padding: 2px;
	}

	.color-swatch::-webkit-color-swatch {
		border: none;
		border-radius: 2px;
	}

	/* Export bar */
	.export-bar {
		display: flex;
		gap: 0.5rem;
	}

	@media (max-width: 480px) {
		.studio {
			padding: 1rem 0.75rem 3rem;
		}

		.toolbar {
			gap: 0.5rem;
		}
	}
</style>
