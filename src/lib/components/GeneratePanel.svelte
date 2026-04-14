<script lang="ts">
	import * as Accordion from '$lib/components/ui/accordion';
	import * as Select from '$lib/components/ui/select';
	import { qrState } from '$lib/qr/state.svelte';
	import { payloadLabels, type PayloadType } from '$lib/qr/payloads';
	import PayloadForm from './PayloadForm.svelte';
	import AppearanceForm from './AppearanceForm.svelte';
	import { cn } from '$lib/utils';

	interface Props {
		activeStep: 'payload' | 'styling';
		onactivestepchange: (step: 'payload' | 'styling') => void;
	}

	let { activeStep, onactivestepchange }: Props = $props();

	const payloadTypeItems = (Object.entries(payloadLabels) as [PayloadType, string][]).map(
		([value, label]) => ({ value, label })
	);
</script>

<Accordion.Root
	type="single"
	bind:value={
		() => activeStep,
		(value) => {
			if (value) onactivestepchange(value as 'payload' | 'styling');
		}
	}
	class="flex min-h-0 flex-1 flex-col"
>
	<Accordion.Item
		value="payload"
		class={`flex flex-col ${activeStep === 'payload' ? 'flex-1' : ''}`}
	>
		<Accordion.Trigger class="w-full py-2">
			<span
				class={`font-heading text-xs font-semibold tracking-[0.03em] uppercase transition-all duration-200 ${activeStep === 'payload' ? 'text-foreground' : 'text-muted-foreground'}`}
				>Payload</span
			>
			<span
				class={cn(
					'flex min-w-0 flex-1 items-center gap-2 px-3',
					qrState.isOverCapacity &&
						'[&_.budget-fill]:!bg-destructive [&_.budget-label]:!text-destructive'
				)}
			>
				<span class="block h-[3px] flex-1 overflow-hidden bg-border">
					<span
						class="budget-fill block h-full bg-muted-foreground transition-[width] duration-150"
						style:width={`${Math.min((qrState.encodedByteLength / qrState.maxBytes) * 100, 100)}%`}
					></span>
				</span>
				<span
					class="budget-label text-[0.6rem] font-semibold whitespace-nowrap text-muted-foreground tabular-nums"
				>
					{qrState.encodedByteLength}<span class="mx-[0.1em] opacity-40">/</span>{qrState.maxBytes}
				</span>
			</span>
		</Accordion.Trigger>
		<Accordion.Content
			class={`flex min-h-0 flex-col gap-3 ${activeStep === 'payload' ? 'pb-2' : 'pb-0'}`}
		>
			<section
				class={cn(
					'flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto',
					qrState.isOverCapacity &&
						'[&_input]:!border-destructive [&_input:focus]:!border-destructive [&_textarea]:!border-destructive [&_textarea:focus]:!border-destructive'
				)}
				aria-label="QR generation form"
			>
				<Select.Root
					type="single"
					value={qrState.payloadType}
					onValueChange={(value: string) => qrState.setPayloadType(value as PayloadType)}
				>
					<Select.Trigger class="h-auto w-full px-3 py-2.5 hover:border-ring">
						<span class="flex w-full items-center gap-2">
							<span
								class="text-[0.7rem] font-semibold tracking-[0.05em] text-muted-foreground uppercase"
								>Type</span
							>
							<span class="flex-1 font-medium">{payloadLabels[qrState.payloadType]}</span>
						</span>
					</Select.Trigger>
					<Select.Content sideOffset={0}>
						{#each payloadTypeItems as item (item.value)}
							<Select.Item value={item.value} label={item.label} class="h-9">
								<span class="flex h-full w-full items-center px-3">{item.label}</span>
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
				<PayloadForm />
			</section>
		</Accordion.Content>
	</Accordion.Item>

	<Accordion.Item
		value="styling"
		class={`flex flex-col ${activeStep === 'styling' ? 'flex-1' : ''}`}
	>
		<Accordion.Trigger class="w-full py-2">
			<span
				class={`font-heading text-xs font-semibold tracking-[0.03em] uppercase transition-all duration-200 ${activeStep === 'styling' ? 'text-foreground' : 'text-muted-foreground'}`}
				>Appearance</span
			>
		</Accordion.Trigger>
		<Accordion.Content
			class={`flex min-h-0 flex-col gap-3 ${activeStep === 'styling' ? 'pb-2' : 'pb-0'}`}
		>
			<AppearanceForm />
		</Accordion.Content>
	</Accordion.Item>
</Accordion.Root>
