<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		items: { value: string; label: string }[];
		value: string;
		onselect: (value: string) => void;
		trigger: Snippet<[{ open: boolean; value: string }]>;
		children?: Snippet<[{ value: string; label: string; selected: boolean }]>;
		align?: 'left' | 'right';
		label?: string;
	}

	let {
		items,
		value,
		onselect,
		trigger,
		children,
		align = 'left',
		label = 'Select an option'
	}: Props = $props();

	let open = $state(false);
	let triggerEl: HTMLButtonElement;
	let menuStyle = $state('');
	let activeIndex = $state(0);
	let optionEls: HTMLButtonElement[] = [];

	function slugifyLabel(currentLabel: string) {
		return currentLabel
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
	}

	const menuId = $derived(`dropdown-menu-${slugifyLabel(label)}`);

	function updateMenuPosition() {
		if (!triggerEl) return;

		const rect = triggerEl.getBoundingClientRect();
		const selectedIdx = Math.max(
			0,
			items.findIndex((item) => item.value === value)
		);
		const itemHeight = 36;
		const idealTop = rect.top - selectedIdx * itemHeight;
		const totalHeight = items.length * itemHeight;
		const maxTop = window.innerHeight - totalHeight - 8;
		const top = Math.max(8, Math.min(idealTop, maxTop));

		const horizontal =
			align === 'right' ? `right: ${window.innerWidth - rect.right}px;` : `left: ${rect.left}px;`;

		menuStyle = `top: ${top}px; ${horizontal} width: ${rect.width}px;`;
	}

	function openMenu(index = items.findIndex((item) => item.value === value)) {
		open = true;
		activeIndex = Math.max(0, index);
		updateMenuPosition();
		requestAnimationFrame(() => optionEls[activeIndex]?.focus());
	}

	function closeMenu(returnFocus = false) {
		open = false;
		if (returnFocus) {
			requestAnimationFrame(() => triggerEl?.focus());
		}
	}

	function toggle(e: MouseEvent) {
		e.stopPropagation();
		if (open) closeMenu();
		else openMenu();
	}

	function select(v: string) {
		onselect(v);
		closeMenu(true);
	}

	function handleTriggerKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			openMenu();
			return;
		}

		if (e.key === 'ArrowUp') {
			e.preventDefault();
			openMenu(items.findIndex((item) => item.value === value));
			return;
		}

		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			if (open) closeMenu();
			else openMenu();
			return;
		}
	}

	function handleMenuKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			closeMenu(true);
			return;
		}

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			activeIndex = (activeIndex + 1) % items.length;
			optionEls[activeIndex]?.focus();
			return;
		}

		if (e.key === 'ArrowUp') {
			e.preventDefault();
			activeIndex = (activeIndex - 1 + items.length) % items.length;
			optionEls[activeIndex]?.focus();
			return;
		}

		if (e.key === 'Home') {
			e.preventDefault();
			activeIndex = 0;
			optionEls[activeIndex]?.focus();
			return;
		}

		if (e.key === 'End') {
			e.preventDefault();
			activeIndex = items.length - 1;
			optionEls[activeIndex]?.focus();
			return;
		}
	}

	function handleWindowClick() {
		if (open) closeMenu();
	}
</script>

<svelte:window onclick={handleWindowClick} />

<div class="dropdown-wrapper">
	<button
		type="button"
		class="dropdown-trigger-btn"
		bind:this={triggerEl}
		aria-label={label}
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-controls={menuId}
		onclick={toggle}
		onkeydown={handleTriggerKeydown}
	>
		{@render trigger({ open, value })}
	</button>

	{#if open}
		<div
			id={menuId}
			class="dropdown-menu"
			style={menuStyle}
			role="listbox"
			aria-label={label}
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={handleMenuKeydown}
		>
			{#each items as entry, index (entry.value)}
				<button
					type="button"
					class="dropdown-item"
					class:selected={value === entry.value}
					role="option"
					aria-selected={value === entry.value}
					bind:this={optionEls[index]}
					onfocus={() => (activeIndex = index)}
					onclick={() => select(entry.value)}
				>
					{#if children}
						{@render children({ ...entry, selected: value === entry.value })}
					{:else}
						<span class="dropdown-item-label">{entry.label}</span>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.dropdown-wrapper {
		position: relative;
	}

	.dropdown-trigger-btn {
		all: unset;
		display: block;
		width: 100%;
		cursor: pointer;
	}

	.dropdown-trigger-btn:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
	}

	.dropdown-menu {
		position: fixed;
		z-index: 9999;
		background: var(--popover);
		border: 1px solid var(--border);
		max-height: 420px;
		overflow-y: auto;
		animation: dropdown-in 0.15s ease;
	}

	@keyframes dropdown-in {
		from {
			opacity: 0;
			transform: scaleY(0.95);
		}
		to {
			opacity: 1;
			transform: scaleY(1);
		}
	}

	.dropdown-item {
		display: block;
		width: 100%;
		padding: 0;
		background: none;
		border: none;
		color: var(--foreground);
		font-size: 0.875rem;
		text-align: left;
		cursor: pointer;
		height: 36px;
		transition: background 0.1s ease;
	}

	.dropdown-item-label {
		display: flex;
		align-items: center;
		height: 100%;
		padding: 0 0.75rem;
	}

	.dropdown-item:hover {
		background: var(--accent);
	}

	.dropdown-item:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: -2px;
	}

	.dropdown-item.selected {
		background: var(--accent);
		font-weight: 600;
	}
</style>
