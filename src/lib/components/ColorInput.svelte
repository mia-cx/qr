<script lang="ts">
	import { focusCls } from '$lib/utils';
	import { normalizeHexColor } from '$lib/qr/helpers';

	interface Props {
		value: string;
		oninput: (v: string) => void;
		label: string;
	}

	let { value, oninput, label }: Props = $props();

	let colorInput = $state('');
	let colorPicker = $state<HTMLInputElement | undefined>(undefined);

	$effect(() => { colorInput = value.toUpperCase(); });

	function updateColorInput(raw: string) {
		colorInput = raw.toUpperCase();
		const normalized = normalizeHexColor(raw);
		if (!normalized) return;
		oninput(normalized);
	}

	function commitColorInput() {
		const normalized = normalizeHexColor(colorInput);
		const nextValue = normalized ?? value;
		colorInput = nextValue.toUpperCase();
		if (normalized) oninput(nextValue);
	}

	function openColorPicker() {
		colorPicker?.click();
	}
</script>

<div class="flex items-center gap-2 h-8 px-2.5 bg-secondary border border-border transition-colors duration-200 hover:border-ring focus-within:border-ring" role="group" aria-label="{label} color">
	<button type="button" class="inline-flex items-center justify-center size-7 p-0 border-none bg-transparent cursor-pointer shrink-0 {focusCls}" aria-label="Open {label.toLowerCase()} color picker" onclick={openColorPicker}>
		<span class="size-5 border border-border block" style={`background: ${value}`}></span>
	</button>
	<input
		bind:this={colorPicker}
		type="color"
		class="sr-only"
		tabindex="-1"
		aria-hidden="true"
		{value}
		oninput={(e) => updateColorInput(e.currentTarget.value)}
	/>
	<input
		type="text"
		class="flex-1 min-w-0 p-0 bg-transparent border-none text-foreground text-xs font-medium font-sans uppercase outline-none placeholder:text-muted-foreground"
		inputmode="text"
		spellcheck="false"
		autocapitalize="characters"
		autocomplete="off"
		maxlength="7"
		aria-label="{label} hex color"
		value={colorInput}
		oninput={(e) => updateColorInput(e.currentTarget.value)}
		onblur={commitColorInput}
		onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitColorInput(); } }}
	/>
</div>
