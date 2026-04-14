<script lang="ts">
	import { Accordion as AccordionPrimitive } from 'bits-ui';
	import { cn, type WithoutChild } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithoutChild<AccordionPrimitive.ContentProps> = $props();
</script>

<AccordionPrimitive.Content
	bind:ref
	data-slot="accordion-content"
	class="grid min-h-0 overflow-hidden text-sm transition-[grid-template-rows] duration-300 data-open:grid-rows-[1fr] data-closed:grid-rows-[0fr]"
	{...restProps}
>
	<div
		class={cn(
			'min-h-0 overflow-hidden pt-0 pb-2.5 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4',
			className
		)}
	>
		{@render children?.()}
	</div>
</AccordionPrimitive.Content>
