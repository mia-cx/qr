<script lang="ts">
	import { page } from '$app/state';
	import { deLocalizeUrl } from '$lib/paraglide/runtime';
	import { getStudioSectionForPath } from '$lib/routes/studio';
	import * as Accordion from '$lib/components/ui/accordion';
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
			try {
				await document.fonts.ready;
			} catch {
				/* progressive enhancement */
			}
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
</script>

<svelte:window onpaste={handlePaste} />
<svelte:head>
	<title>qr.mia.cx</title>
	<meta name="description" content="QR code generator and reader" />
</svelte:head>

<main
	class="flex h-[100vh] items-center justify-center overflow-hidden bg-background p-2 transition-[background,color] duration-300 max-sm:h-auto max-sm:min-h-[100vh] max-sm:overflow-visible"
>
	<h1 class="sr-only">QR code generator and reader</h1>
	<div
		class="grid h-[min(720px,calc(100vh-1rem))] w-full max-w-[900px] grid-cols-2 grid-rows-[auto_1fr] overflow-hidden border border-border transition-[border-color] duration-300 max-sm:h-auto max-sm:max-w-full max-sm:grid-cols-1"
		aria-labelledby="app-subtitle"
	>
		<header
			class="col-span-full flex items-center justify-between border-b border-border px-8 py-5"
		>
			<div class="flex items-baseline gap-0.5" id="app-subtitle">
				<span class="font-heading text-xl leading-[1.5] font-bold text-foreground">QR</span>
				<span class="font-heading text-xs leading-[1.5] text-muted-foreground">.mia.cx</span>
			</div>
			<ThemeSwitcher />
		</header>

		<!-- Left: Form -->
		<section
			class="flex min-h-0 flex-col gap-0 overflow-hidden px-8 py-6 max-sm:max-h-none max-sm:px-6"
			aria-labelledby="controls-heading"
		>
			<h2 id="controls-heading" class="sr-only">QR controls</h2>
			<Accordion.Root
				type="single"
				bind:value={
					() => activeSection,
					(value) => {
						if (value) activeSection = value as Section;
					}
				}
				class="flex min-h-0 flex-1 flex-col"
			>
				<Accordion.Item
					value="generate"
					class={`flex flex-col ${activeSection === 'generate' ? 'flex-1' : ''}`}
				>
					<Accordion.Trigger class="w-full py-3 transition-colors duration-300">
						<span
							class={`font-heading font-medium transition-all duration-200 ${activeSection === 'generate' ? 'text-lg font-semibold text-foreground' : 'text-[0.85rem] text-muted-foreground'}`}
							>Create a QR code</span
						>
					</Accordion.Trigger>
					<Accordion.Content
						class={`flex min-h-0 flex-col gap-3 ${activeSection === 'generate' ? 'pb-3' : 'pb-0'}`}
					>
						<GeneratePanel {activeStep} onactivestepchange={(s) => (activeStep = s)} />
					</Accordion.Content>
				</Accordion.Item>

				<Accordion.Item
					value="read"
					class={`flex flex-col ${activeSection === 'read' ? 'flex-1' : ''}`}
				>
					<Accordion.Trigger class="w-full py-3 transition-colors duration-300">
						<span
							class={`font-heading font-medium transition-all duration-200 ${activeSection === 'read' ? 'text-lg font-semibold text-foreground' : 'text-[0.85rem] text-muted-foreground'}`}
							>Read a QR code</span
						>
					</Accordion.Trigger>
					<Accordion.Content
						class={`flex min-h-0 flex-col gap-3 ${activeSection === 'read' ? 'pb-3' : 'pb-0'}`}
					>
						<ReadPanel
							bind:this={readPanel}
							onswitchtogenerate={() => {
								activeSection = 'generate';
								activeStep = 'payload';
							}}
						/>
					</Accordion.Content>
				</Accordion.Item>
			</Accordion.Root>
		</section>

		<!-- Right: QR Preview -->
		<aside
			class="flex min-h-full flex-col border-l border-border bg-secondary p-8 transition-[background,border-color] duration-300 max-sm:min-h-[200px] max-sm:border-b max-sm:border-l-0 max-sm:border-border max-sm:p-6"
			aria-labelledby="preview-heading"
		>
			<h2 id="preview-heading" class="sr-only">QR preview and export options</h2>
			<PreviewPanel />
		</aside>
	</div>
</main>
