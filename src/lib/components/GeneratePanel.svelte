<script lang="ts">
	import { qrState } from '$lib/qr/state.svelte';
	import { payloadLabels, type PayloadType } from '$lib/qr/payloads';
	import PayloadForm from './PayloadForm.svelte';
	import AppearanceForm from './AppearanceForm.svelte';
	import Dropdown from './Dropdown.svelte';
	import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '$lib/components/ui/accordion';

	interface Props {
		activeStep: 'payload' | 'styling';
		onactivestepchange: (step: 'payload' | 'styling') => void;
	}

	let { activeStep, onactivestepchange }: Props = $props();

	const payloadTypeItems = (Object.entries(payloadLabels) as [PayloadType, string][]).map(
		([value, label]) => ({ value, label })
	);
</script>

<Accordion type="single" value={activeStep} onValueChange={(v) => { if (v) onactivestepchange(v as 'payload' | 'styling'); }}>
	<AccordionItem value="payload">
		<AccordionTrigger level={4} class="py-2">
			<span class="font-heading text-xs font-semibold tracking-[0.03em] uppercase transition-all duration-200 {activeStep === 'payload' ? 'text-foreground' : 'text-muted-foreground'}">Payload</span>
			<span class="flex-1 flex items-center gap-2 px-3 min-w-0 {qrState.isOverCapacity ? '[&_.budget-fill]:!bg-destructive [&_.budget-label]:!text-destructive' : ''}">
				<span class="block flex-1 h-[3px] bg-border overflow-hidden">
					<span
						class="budget-fill block h-full bg-muted-foreground transition-[width] duration-150"
						style:width="{Math.min((qrState.encodedByteLength / qrState.maxBytes) * 100, 100)}%"
					></span>
				</span>
				<span class="budget-label text-[0.6rem] font-semibold tabular-nums text-muted-foreground whitespace-nowrap">
					{qrState.encodedByteLength}<span class="opacity-40 mx-[0.1em]">/</span>{qrState.maxBytes}
				</span>
			</span>
		</AccordionTrigger>
		<AccordionContent class="flex flex-col gap-3 pb-2">
			<section class="flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto {qrState.isOverCapacity ? '[&_input]:!border-destructive [&_textarea]:!border-destructive [&_input:focus]:!border-destructive [&_textarea:focus]:!border-destructive' : ''}" aria-label="QR generation form">
				<Dropdown
					items={payloadTypeItems}
					value={qrState.payloadType}
					label="QR content type"
					onselect={(v) => qrState.setPayloadType(v as PayloadType)}
				>
					{#snippet trigger({ open, value })}
						<span class="flex items-center gap-2 w-full py-2.5 px-3 bg-secondary border border-border text-foreground cursor-pointer text-sm transition-colors duration-200 hover:border-ring">
							<span class="text-[0.7rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Type</span>
							<span class="flex-1 font-medium">{payloadLabels[value as PayloadType]}</span>
							<svg
								class="transition-transform duration-150 text-muted-foreground {open ? 'rotate-180' : ''}"
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
				<PayloadForm />
			</section>
		</AccordionContent>
	</AccordionItem>

	<AccordionItem value="styling">
		<AccordionTrigger level={4} class="py-2">
			<span class="font-heading text-xs font-semibold tracking-[0.03em] uppercase transition-all duration-200 {activeStep === 'styling' ? 'text-foreground' : 'text-muted-foreground'}">Appearance</span>
		</AccordionTrigger>
		<AccordionContent class="flex flex-col gap-3 pb-2">
			<AppearanceForm />
		</AccordionContent>
	</AccordionItem>
</Accordion>
