<script lang="ts">
	import { normalizeHexColor } from '$lib/qr/helpers';
	import { focusCls } from '$lib/utils';

	interface Props {
		label: string;
		value: string;
		oninput: (value: string) => void;
	}

	let { label, value, oninput }: Props = $props();

	let textValue = $state('');
	let pickerEl = $state<HTMLInputElement | undefined>(undefined);

	$effect(() => {
		textValue = value.toUpperCase();
	});

	function updateText(rawValue: string) {
		textValue = rawValue.toUpperCase();
		const normalized = normalizeHexColor(rawValue);
		if (normalized) oninput(normalized);
	}

	function commitText() {
		const normalized = normalizeHexColor(textValue);
		const nextValue = normalized ?? value;
		textValue = nextValue.toUpperCase();
		if (normalized) oninput(nextValue);
	}

	function openPicker() {
		pickerEl?.click();
	}
</script>

<div class="relative flex min-w-0 flex-1 flex-col gap-1">
	<span
		class="text-[0.65rem] leading-5 font-semibold tracking-wider text-muted-foreground uppercase"
	>
		{label}
	</span>
	<div
		class="flex h-8 items-center gap-2 border border-border bg-secondary px-2.5 transition-colors duration-200 focus-within:border-ring hover:border-ring"
		role="group"
		aria-label={`${label} color`}
	>
		<button
			type="button"
			class={`inline-flex size-7 shrink-0 items-center justify-center border-none bg-transparent p-0 ${focusCls}`}
			aria-label={`Open ${label.toLowerCase()} color picker`}
			onclick={openPicker}
		>
			<span class="block size-5 border border-border" style={`background: ${value}`}></span>
		</button>
		<input
			bind:this={pickerEl}
			type="color"
			class="sr-only"
			tabindex="-1"
			aria-hidden="true"
			{value}
			oninput={(event) => updateText(event.currentTarget.value)}
		/>
		<input
			type="text"
			class="min-w-0 flex-1 border-none bg-transparent p-0 font-sans text-xs font-medium text-foreground uppercase outline-none placeholder:text-muted-foreground"
			inputmode="text"
			spellcheck="false"
			autocapitalize="characters"
			autocomplete="off"
			maxlength="7"
			aria-label={`${label} hex color`}
			value={textValue}
			oninput={(event) => updateText(event.currentTarget.value)}
			onblur={commitText}
			onkeydown={(event) => {
				if (event.key === 'Enter') {
					event.preventDefault();
					commitText();
				}
			}}
		/>
	</div>
</div>
