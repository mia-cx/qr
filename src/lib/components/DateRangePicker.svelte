<script lang="ts">
	import RangeCalendar from '$lib/components/ui/range-calendar/range-calendar.svelte';
	import { CalendarDate, type DateValue } from '@internationalized/date';
	import type { DateRange } from 'bits-ui';

	interface Props {
		start: string;
		end: string;
		onchange: (start: string, end: string) => void;
		label?: string;
	}

	let { start, end, onchange, label = 'Date and time range' }: Props = $props();

	let open = $state(false);
	let triggerEl: HTMLButtonElement;
	let panelEl = $state<HTMLDivElement | undefined>(undefined);
	let panelStyle = $state('');

	function slugifyLabel(currentLabel: string) {
		return currentLabel
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
	}

	const panelId = $derived(`${slugifyLabel(label)}-panel`);
	const startTimeId = $derived(`${slugifyLabel(label)}-start`);
	const endTimeId = $derived(`${slugifyLabel(label)}-end`);

	function parseDate(str: string): CalendarDate | undefined {
		if (!str) return undefined;
		const [datePart] = str.split('T');
		const [y, m, d] = datePart.split('-').map(Number);
		if (!y || !m || !d) return undefined;
		return new CalendarDate(y, m, d);
	}

	function parseTime(str: string): string {
		if (!str) return '00:00';
		const parts = str.split('T');
		return parts[1]?.slice(0, 5) ?? '00:00';
	}

	function formatDatetime(date: DateValue | undefined, time: string): string {
		if (!date) return '';
		const y = String(date.year).padStart(4, '0');
		const m = String(date.month).padStart(2, '0');
		const d = String(date.day).padStart(2, '0');
		return `${y}-${m}-${d}T${time}`;
	}

	let rangeValue = $state<DateRange>({ start: undefined, end: undefined });
	let startTime = $state('00:00');
	let endTime = $state('00:00');
	let lastSyncedStart = $state<string | undefined>(undefined);
	let lastSyncedEnd = $state<string | undefined>(undefined);

	$effect(() => {
		if (start === lastSyncedStart && end === lastSyncedEnd) return;
		rangeValue = { start: parseDate(start), end: parseDate(end) };
		startTime = parseTime(start);
		endTime = parseTime(end);
		lastSyncedStart = start;
		lastSyncedEnd = end;
	});

	function emitChange() {
		const nextStart = formatDatetime(rangeValue.start, startTime);
		const nextEnd = formatDatetime(rangeValue.end, endTime);
		lastSyncedStart = nextStart;
		lastSyncedEnd = nextEnd;
		onchange(nextStart, nextEnd);
	}

	function handleRangeChange(val: DateRange) {
		rangeValue = val;
		emitChange();
	}

	function handleStartTime(e: Event) {
		startTime = (e.target as HTMLInputElement).value;
		emitChange();
	}

	function handleEndTime(e: Event) {
		endTime = (e.target as HTMLInputElement).value;
		emitChange();
	}

	function toggle(e: MouseEvent) {
		e.stopPropagation();
		open = !open;
		if (open && triggerEl) {
			const rect = triggerEl.getBoundingClientRect();
			const triggerCenter = rect.left + rect.width / 2;
			const top = rect.bottom + 4;
			panelStyle = `top: ${top}px; left: ${triggerCenter}px; transform: translateX(-50%);`;
			requestAnimationFrame(() => panelEl?.focus());
		}
	}

	function close() {
		open = false;
		requestAnimationFrame(() => triggerEl?.focus());
	}

	function handleTriggerKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			if (!open) {
				open = true;
				if (triggerEl) {
					const rect = triggerEl.getBoundingClientRect();
					const triggerCenter = rect.left + rect.width / 2;
					const top = rect.bottom + 4;
					panelStyle = `top: ${top}px; left: ${triggerCenter}px; transform: translateX(-50%);`;
					requestAnimationFrame(() => panelEl?.focus());
				}
			}
		}

		if (e.key === 'Escape' && open) {
			e.preventDefault();
			close();
		}
	}

	function handleWindowClick() {
		if (open) close();
	}

	const displayText = $derived.by(() => {
		const s = rangeValue.start;
		const e = rangeValue.end;
		if (!s && !e) return 'Pick dates & times';
		const fmt = (d: DateValue) => `${d.day}/${d.month}/${d.year}`;
		if (s && e) return `${fmt(s)} ${startTime} - ${fmt(e)} ${endTime}`;
		if (s) return `${fmt(s)} ${startTime} - ...`;
		return 'Pick dates & times';
	});
</script>

<svelte:window onclick={handleWindowClick} />

<div class="date-picker-wrapper">
	<button
		type="button"
		class="date-trigger"
		bind:this={triggerEl}
		aria-label={label}
		aria-haspopup="dialog"
		aria-expanded={open}
		aria-controls={panelId}
		onclick={toggle}
		onkeydown={handleTriggerKeydown}
	>
		<svg
			width="14"
			height="14"
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
		>
			<rect x="2" y="3" width="12" height="11" />
			<path d="M2 7h12M5 1v4M11 1v4" />
		</svg>
		<span class="date-trigger-text">{displayText}</span>
		<svg
			class="chevron"
			class:open
			width="12"
			height="12"
			viewBox="0 0 14 14"
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"><path d="M4 6l3 3 3-3" /></svg
		>
	</button>

	{#if open}
		<div
			id={panelId}
			bind:this={panelEl}
			class="date-panel"
			style={panelStyle}
			role="dialog"
			aria-label={`${label} picker`}
			aria-modal="false"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => {
				if (e.key === 'Escape') {
					e.preventDefault();
					close();
				}
			}}
		>
			<RangeCalendar bind:value={rangeValue} onValueChange={handleRangeChange} numberOfMonths={2} />
			<div class="time-row">
				<div class="time-field">
					<label class="time-label" for={startTimeId}>Start time</label>
					<input
						id={startTimeId}
						type="time"
						class="time-input"
						value={startTime}
						oninput={handleStartTime}
					/>
				</div>
				<span class="time-separator">-</span>
				<div class="time-field">
					<label class="time-label" for={endTimeId}>End time</label>
					<input
						id={endTimeId}
						type="time"
						class="time-input"
						value={endTime}
						oninput={handleEndTime}
					/>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.date-picker-wrapper {
		position: relative;
	}

	.date-trigger {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.625rem 0.75rem;
		background: var(--secondary);
		border: 1px solid var(--border);
		border-radius: 0;
		color: var(--foreground);
		cursor: pointer;
		font-size: 0.8rem;
		transition: border-color 0.15s ease;
	}

	.date-trigger:hover {
		border-color: var(--ring);
	}

	.date-trigger:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
	}

	.date-trigger-text {
		flex: 1;
		text-align: left;
		font-weight: 500;
	}

	.chevron {
		transition: transform 0.15s ease;
		color: var(--muted-foreground);
	}

	.chevron.open {
		transform: rotate(180deg);
	}

	.date-panel {
		position: fixed;
		z-index: 9999;
		background: var(--popover);
		border: 1px solid var(--border);
		animation: panel-in 0.15s ease;
	}

	.date-panel:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
	}

	@keyframes panel-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.time-row {
		display: flex;
		align-items: end;
		gap: 0.5rem;
		padding: 0.75rem;
		border-top: 1px solid var(--border);
	}

	.time-field {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.time-label {
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--muted-foreground);
	}

	.time-input {
		width: 100%;
		padding: 0.5rem 0.625rem;
		background: var(--secondary);
		border: 1px solid var(--border);
		border-radius: 0;
		color: var(--foreground);
		font-size: 0.8rem;
		font-family: inherit;
		outline: none;
		transition: border-color 0.15s ease;
	}

	.time-input:focus {
		border-color: var(--ring);
	}

	.time-separator {
		color: var(--muted-foreground);
		font-weight: 500;
		padding-bottom: 0.5rem;
	}
</style>
