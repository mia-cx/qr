<script lang="ts">
	import { Accordion as AccordionPrimitive } from "bits-ui";
	import { cn, type WithoutChild } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithoutChild<AccordionPrimitive.ContentProps> = $props();
</script>

<AccordionPrimitive.Content
	bind:ref
	forceMount
	data-slot="accordion-content"
	class="grid overflow-hidden transition-[grid-template-rows] duration-300 data-[state=open]:grid-rows-[1fr] data-[state=closed]:grid-rows-[0fr]"
	{...restProps}
>
	<div class={cn("overflow-hidden min-h-0", className)}>
		{@render children?.()}
	</div>
</AccordionPrimitive.Content>
