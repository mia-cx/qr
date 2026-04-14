<script lang="ts">
	import { Accordion as AccordionPrimitive } from 'bits-ui';
	import { cn, type WithoutChild } from '$lib/utils.js';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';

	let {
		ref = $bindable(null),
		class: className,
		level = 3,
		children,
		...restProps
	}: WithoutChild<AccordionPrimitive.TriggerProps> & {
		level?: AccordionPrimitive.HeaderProps['level'];
	} = $props();
</script>

<AccordionPrimitive.Header {level} class="flex">
	<AccordionPrimitive.Trigger
		data-slot="accordion-trigger"
		bind:ref
		class={cn(
			'group/accordion-trigger relative flex flex-1 items-center justify-between gap-3 border-0 bg-transparent py-3 text-left font-heading text-sm font-medium text-foreground transition-[color,transform] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 **:data-[slot=accordion-trigger-icon]:ml-auto **:data-[slot=accordion-trigger-icon]:size-4 **:data-[slot=accordion-trigger-icon]:text-muted-foreground',
			className
		)}
		{...restProps}
	>
		{@render children?.()}
		<ChevronDownIcon
			data-slot="accordion-trigger-icon"
			class="cn-accordion-trigger-icon pointer-events-none shrink-0 transition-transform duration-200 group-aria-expanded/accordion-trigger:rotate-180"
		/>
	</AccordionPrimitive.Trigger>
</AccordionPrimitive.Header>
