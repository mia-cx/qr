<script lang="ts">
	import { qrState } from '$lib/qr/state.svelte';
	import { WIFI_ENCRYPTION_VALUES } from '$lib/qr/constants';
	import { moveRadioSelection } from '$lib/utils';

	let showPassword = $state(false);

	function handleEncryptionKeydown(
		e: KeyboardEvent,
		current: (typeof WIFI_ENCRYPTION_VALUES)[number]
	) {
		if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
		e.preventDefault();
		const direction = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
		qrState.setPayloadField(
			'wifi',
			'encryption',
			moveRadioSelection(WIFI_ENCRYPTION_VALUES, current, direction)
		);
	}
</script>

<div class="flex flex-col gap-2">
	<label
		class="flex items-stretch border border-border bg-secondary transition-colors duration-150 focus-within:border-ring"
	>
		<span
			class="flex shrink-0 items-center border-r border-border px-2.5 text-[0.65rem] font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase"
			>SSID</span
		>
		<input
			class="w-full border-none bg-transparent px-3 py-2.5 font-sans text-sm text-foreground transition-colors duration-150 outline-none placeholder:text-muted-foreground focus:border-transparent"
			type="text"
			aria-label="Wi-Fi network name"
			value={qrState.payloads.wifi.ssid}
			oninput={(e) => qrState.setPayloadField('wifi', 'ssid', e.currentTarget.value)}
		/>
	</label>
	<label
		class="flex items-stretch border border-border bg-secondary transition-colors duration-150 focus-within:border-ring"
	>
		<span
			class="flex shrink-0 items-center border-r border-border px-2.5 text-[0.65rem] font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase"
			>Password</span
		>
		<div class="relative flex min-w-0 flex-1 items-center">
			<input
				class="w-full border-none bg-transparent px-3 py-2.5 pr-10 font-sans text-sm text-foreground transition-colors duration-150 outline-none placeholder:text-muted-foreground focus:border-transparent"
				type={showPassword ? 'text' : 'password'}
				aria-label="Wi-Fi password"
				value={qrState.payloads.wifi.password}
				oninput={(e) => qrState.setPayloadField('wifi', 'password', e.currentTarget.value)}
			/>
			<button
				type="button"
				class="absolute right-2 flex cursor-pointer appearance-none items-center border-none bg-transparent p-1 text-muted-foreground hover:text-foreground"
				aria-label={showPassword ? 'Hide password' : 'Show password'}
				onclick={() => (showPassword = !showPassword)}
			>
				{#if showPassword}
					<svg
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
					>
						<path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" /><circle cx="8" cy="8" r="2" />
					</svg>
				{:else}
					<svg
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
					>
						<path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" /><circle
							cx="8"
							cy="8"
							r="2"
						/><path d="M3 13L13 3" />
					</svg>
				{/if}
			</button>
		</div>
	</label>
	<div class="flex items-center justify-between gap-2">
		<span
			class="m-0 text-[0.7rem] font-semibold tracking-wider text-muted-foreground uppercase"
			id="wifi-encryption-label">Encryption</span
		>
		<div
			class="flex gap-0 border border-border"
			role="radiogroup"
			aria-labelledby="wifi-encryption-label"
		>
			{#each ['WPA', 'WEP', 'None'] as enc (enc)}
				{@const val = (enc === 'None' ? 'nopass' : enc) as (typeof WIFI_ENCRYPTION_VALUES)[number]}
				<button
					type="button"
					class="cursor-pointer border-0 border-r border-border bg-transparent px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-muted-foreground transition-all duration-150 last:border-r-0 hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring {qrState
						.payloads.wifi.encryption === val
						? 'bg-foreground !text-background'
						: ''}"
					role="radio"
					aria-checked={qrState.payloads.wifi.encryption === val}
					onkeydown={(e) => handleEncryptionKeydown(e, val)}
					onclick={() => qrState.setPayloadField('wifi', 'encryption', val)}>{enc}</button
				>
			{/each}
		</div>
	</div>
	<div class="flex items-center justify-between gap-2">
		<span class="m-0 text-[0.7rem] font-semibold tracking-wider text-muted-foreground uppercase"
			>Hidden network</span
		>
		<button
			type="button"
			class="flex size-[18px] shrink-0 cursor-pointer items-center justify-center border border-border p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring {qrState
				.payloads.wifi.hidden
				? 'bg-foreground text-background'
				: 'bg-transparent text-foreground'}"
			aria-label="Hidden network"
			aria-pressed={qrState.payloads.wifi.hidden}
			onclick={() => qrState.setPayloadField('wifi', 'hidden', !qrState.payloads.wifi.hidden)}
		>
			{#if qrState.payloads.wifi.hidden}
				<svg
					width="12"
					height="12"
					viewBox="0 0 12 12"
					fill="none"
					stroke="currentColor"
					stroke-width="2"><path d="M2 6l3 3 5-5" /></svg
				>
			{/if}
		</button>
	</div>
</div>
