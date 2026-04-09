<script lang="ts">
	import { page } from '$app/state';
	import { deLocalizeUrl } from '$lib/paraglide/runtime';
	import { getStudioSectionForPath } from '$lib/routes/studio';
	import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
	import GeneratePanel from '$lib/components/GeneratePanel.svelte';
	import ReadPanel from '$lib/components/ReadPanel.svelte';
	import PreviewPanel from '$lib/components/PreviewPanel.svelte';
	import { onMount } from 'svelte';

	type Section = 'generate' | 'read';

	let activeSection = $state<Section>('generate');
	let activeStep = $state<'payload' | 'styling'>('payload');
	let readPanel = $state<ReadPanel | undefined>(undefined);

	const routeSection = $derived(getStudioSectionForPath(deLocalizeUrl(page.url).pathname));

	onMount(() => {
		const revealApp = async () => {
			try { await document.fonts.ready; } catch { /* progressive enhancement */ }
			document.documentElement.setAttribute('data-app-ready', 'true');
		};
		void revealApp();
	});

	$effect(() => {
		if (routeSection) activeSection = routeSection;
	});

	function handlePaste(e: ClipboardEvent) {
		if (activeSection === 'read') readPanel?.handleGlobalPaste(e);
	}

	const focusCls = "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2";
	const accordionTriggerCls = `flex items-center justify-between w-full py-3 bg-transparent border-0 border-t border-border cursor-pointer text-foreground text-left transition-colors duration-300 ${focusCls}`;
</script>

<svelte:window onpaste={handlePaste} />
<svelte:head>
	<title>qr.mia.cx</title>
	<meta name="description" content="QR code generator and reader" />
</svelte:head>

<main class="h-[100vh] flex items-center justify-center p-2 overflow-hidden bg-background transition-[background,color] duration-300 max-sm:h-auto max-sm:min-h-[100vh] max-sm:overflow-visible">
	<h1 class="sr-only">QR code generator and reader</h1>
	<div class="grid grid-cols-2 grid-rows-[auto_1fr] w-full max-w-[900px] h-[min(720px,calc(100vh-1rem))] border border-border overflow-hidden transition-[border-color] duration-300 max-sm:grid-cols-1 max-sm:max-w-full max-sm:h-auto" aria-labelledby="app-subtitle">
		<header class="col-span-full flex items-center justify-between px-8 py-5 border-b border-border">
			<div class="flex items-baseline gap-0.5" id="app-subtitle">
				<span class="font-heading font-bold text-xl leading-[1.5] text-foreground">QR</span>
				<span class="font-heading text-xs leading-[1.5] text-muted-foreground">.mia.cx</span>
			</div>
			<ThemeSwitcher />
		</header>

		<!-- Left: Form -->
		<section class="px-8 py-6 flex flex-col gap-0 overflow-hidden min-h-0 max-sm:max-h-none max-sm:px-6" aria-labelledby="controls-heading">
			<h2 id="controls-heading" class="sr-only">QR controls</h2>

			<!-- Accordion: Generate (first — no top border) -->
			<h3 class="m-0">
				<button
					type="button"
					class="{accordionTriggerCls} !border-t-0"
					aria-expanded={activeSection === 'generate'}
					aria-controls="generate-panel"
					id="generate-trigger"
					onclick={() => (activeSection = 'generate')}
				>
					<span class="font-heading font-medium transition-all duration-200 {activeSection === 'generate' ? 'text-lg font-semibold text-foreground' : 'text-[0.85rem] text-muted-foreground'}">Create a QR code</span>
					<svg class="transition-transform duration-200 text-muted-foreground shrink-0 {activeSection === 'generate' ? 'rotate-180' : ''}" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 6l4 4 4-4" /></svg>
				</button>
			</h3>

			<div
				id="generate-panel"
				class="grid min-h-0 overflow-hidden transition-[grid-template-rows] duration-300 {activeSection === 'generate' ? 'grid-rows-[1fr] flex-[1_1_0px]' : 'grid-rows-[0fr] flex-[0_0_auto]'}"
				role="region"
				aria-labelledby="generate-trigger"
			>
				<div class="flex flex-col gap-3 overflow-hidden min-h-0 {activeSection === 'generate' ? 'h-auto pb-3' : 'h-0'}">
					<GeneratePanel {activeStep} onactivestepchange={(s) => (activeStep = s)} />
				</div>
			</div>

			<!-- Accordion: Read -->
			<h3 class="m-0">
				<button
					type="button"
					class={accordionTriggerCls}
					aria-expanded={activeSection === 'read'}
					aria-controls="read-panel"
					id="read-trigger"
					onclick={() => (activeSection = 'read')}
				>
					<span class="font-heading font-medium transition-all duration-200 {activeSection === 'read' ? 'text-lg font-semibold text-foreground' : 'text-[0.85rem] text-muted-foreground'}">Read a QR code</span>
					<svg class="transition-transform duration-200 text-muted-foreground shrink-0 {activeSection === 'read' ? 'rotate-180' : ''}" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 6l4 4 4-4" /></svg>
				</button>
			</h3>

			<div
				id="read-panel"
				class="grid min-h-0 overflow-hidden transition-[grid-template-rows] duration-300 {activeSection === 'read' ? 'grid-rows-[1fr] flex-[1_1_0px]' : 'grid-rows-[0fr] flex-[0_0_auto]'}"
				role="region"
				aria-labelledby="read-trigger"
			>
				<div class="flex flex-col gap-3 overflow-hidden min-h-0 {activeSection === 'read' ? 'h-auto pb-3' : 'h-0'}">
					<ReadPanel
						bind:this={readPanel}
						onswitchtogenerate={() => { activeSection = 'generate'; activeStep = 'payload'; }}
					/>
				</div>
			</div>
		</section>

		<!-- Right: QR Preview -->
		<aside class="flex flex-col p-8 bg-secondary border-l border-border min-h-full transition-[background,border-color] duration-300 max-sm:border-l-0 max-sm:border-b max-sm:border-border max-sm:min-h-[200px] max-sm:p-6" aria-labelledby="preview-heading">
			<h2 id="preview-heading" class="sr-only">QR preview and export options</h2>
			<PreviewPanel />
		</aside>
	</div>
</main>
