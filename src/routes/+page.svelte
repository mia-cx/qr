<script lang="ts">
	import { page } from '$app/state';
	import { deLocalizeUrl } from '$lib/paraglide/runtime';
	import { getStudioSectionForPath } from '$lib/routes/studio';
	import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
	import GeneratePanel from '$lib/components/GeneratePanel.svelte';
	import ReadPanel from '$lib/components/ReadPanel.svelte';
	import PreviewPanel from '$lib/components/PreviewPanel.svelte';
	import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '$lib/components/ui/accordion';
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

	const triggerTextCls = "font-heading font-medium transition-all duration-200";
	const triggerActiveTextCls = "text-lg font-semibold text-foreground";
	const triggerInactiveTextCls = "text-[0.85rem] text-muted-foreground";
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

			<Accordion type="single" bind:value={activeSection}>
				<AccordionItem value="generate">
					<AccordionTrigger level={3}>
						<span class="{triggerTextCls} {activeSection === 'generate' ? triggerActiveTextCls : triggerInactiveTextCls}">Create a QR code</span>
					</AccordionTrigger>
					<AccordionContent class="flex flex-col gap-3 pb-3">
						<GeneratePanel {activeStep} onactivestepchange={(s) => (activeStep = s)} />
					</AccordionContent>
				</AccordionItem>

				<AccordionItem value="read">
					<AccordionTrigger level={3}>
						<span class="{triggerTextCls} {activeSection === 'read' ? triggerActiveTextCls : triggerInactiveTextCls}">Read a QR code</span>
					</AccordionTrigger>
					<AccordionContent class="flex flex-col gap-3 pb-3">
						<ReadPanel
							bind:this={readPanel}
							onswitchtogenerate={() => { activeSection = 'generate'; activeStep = 'payload'; }}
						/>
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</section>

		<!-- Right: QR Preview -->
		<aside class="flex flex-col p-8 bg-secondary border-l border-border min-h-full transition-[background,border-color] duration-300 max-sm:border-l-0 max-sm:border-b max-sm:border-border max-sm:min-h-[200px] max-sm:p-6" aria-labelledby="preview-heading">
			<h2 id="preview-heading" class="sr-only">QR preview and export options</h2>
			<PreviewPanel />
		</aside>
	</div>
</main>
