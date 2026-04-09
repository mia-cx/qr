<script lang="ts">
	import {
		decodePayload,
		encodeCalendarPayload,
		encodeVcardPayload,
		getSafeExternalHref,
		getSafePhoneHref,
		getSafeSmsHref,
		getSafeMailtoHref,
		getSafeGeoHref,
		normalizeLineEndingsForFile,
		payloadLabels,
		type PayloadType,
		type PayloadFields
	} from '$lib/qr/payloads';
	import { downloadBlob, focusCls } from '$lib/utils';

	interface Props {
		raw: string;
		onuse: () => void;
	}

	let { raw, onuse }: Props = $props();

	let showPassword = $state(false);

	const decoded = $derived(decodePayload(raw));
	const type = $derived(decoded.type);
	const fields = $derived(decoded.fields);

	function downloadVcf() {
		const f = fields as PayloadFields['vcard'];
		const name = `${f.firstName}_${f.lastName}`.replace(/\s+/g, '_') || 'contact';
		downloadBlob(
			new Blob([normalizeLineEndingsForFile(encodeVcardPayload(f))], { type: 'text/vcard' }),
			`${name}.vcf`
		);
	}

	function downloadIcs() {
		const f = fields as PayloadFields['calendar'];
		const name = f.title.replace(/\s+/g, '_') || 'event';
		downloadBlob(
			new Blob([normalizeLineEndingsForFile(encodeCalendarPayload(f))], { type: 'text/calendar' }),
			`${name}.ics`
		);
	}

	const fieldLabelCls = "text-[0.65rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground";
	const fieldValueCls = "text-[0.85rem] text-foreground";
	const fieldMutedCls = "text-[0.8rem] text-muted-foreground";
	const linkCls = "text-foreground underline underline-offset-2 text-[0.85rem] break-all hover:text-muted-foreground";
	const contactNameCls = "font-heading font-semibold text-[0.95rem]";
	const preTextCls = "p-2 bg-secondary border border-border text-[0.8rem] text-foreground whitespace-pre-wrap break-all m-0";
	const actionBtnCls = `flex items-center gap-1.5 py-1.5 px-2.5 bg-secondary border border-border text-foreground text-xs cursor-pointer transition-colors duration-150 hover:bg-accent ${focusCls}`;
</script>

<section class="flex flex-col gap-2" aria-live="polite">
	<div class="flex items-center gap-2">
		<span class="font-heading text-[0.7rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground py-0.5 px-1.5 border border-border bg-secondary">{payloadLabels[type]}</span>
	</div>

	<div class="flex flex-col gap-1">
		{#if type === 'url'}
			{@const f = fields as PayloadFields['url']}
			{@const safeHref = getSafeExternalHref(f.url)}
			{#if safeHref}
				<a href={safeHref} target="_blank" rel="noopener noreferrer" class={linkCls}>{f.url}</a>
			{:else}
				<span class={fieldValueCls}>{f.url}</span>
			{/if}

		{:else if type === 'wifi'}
			{@const f = fields as PayloadFields['wifi']}
			<div class="flex flex-col gap-1.5">
				<div class="flex flex-col gap-0.5">
					<span class={fieldLabelCls}>Network</span>
					<span class={fieldValueCls}>{f.ssid}</span>
				</div>
				<div class="flex flex-col gap-0.5">
					<span class={fieldLabelCls}>Password</span>
					<span class="flex items-center gap-1.5 py-1.5 px-2 bg-secondary border border-border text-[0.85rem]">
						<span class="flex-1 font-sans">{showPassword ? f.password : '•'.repeat(f.password.length || 8)}</span>
						<button type="button" class="cursor-pointer text-muted-foreground flex items-center p-0.5 hover:text-foreground bg-transparent border-none {focusCls}" onclick={() => showPassword = !showPassword} aria-label={showPassword ? 'Hide password' : 'Show password'}>
							{#if showPassword}
								<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z"/><circle cx="8" cy="8" r="2"/></svg>
							{:else}
								<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z"/><circle cx="8" cy="8" r="2"/><path d="M3 13L13 3"/></svg>
							{/if}
						</button>
					</span>
				</div>
				<div class="flex flex-col gap-0.5">
					<span class={fieldLabelCls}>Encryption</span>
					<span class={fieldValueCls}>{f.encryption === 'nopass' ? 'None' : f.encryption}</span>
				</div>
				{#if f.hidden}
					<div class="flex flex-col gap-0.5">
						<span class={fieldLabelCls}>Hidden</span>
						<span class={fieldValueCls}>Yes</span>
					</div>
				{/if}
			</div>

		{:else if type === 'phone'}
			{@const f = fields as PayloadFields['phone']}
			{@const phoneHref = getSafePhoneHref(f.number)}
			{#if phoneHref}
				<a href={phoneHref} class={linkCls}>{f.number}</a>
			{:else}
				<span class={fieldValueCls}>{f.number}</span>
			{/if}

		{:else if type === 'sms'}
			{@const f = fields as PayloadFields['sms']}
			{@const smsHref = getSafeSmsHref(f.number)}
			<div class="flex flex-col gap-1.5">
				{#if smsHref}
					<a href={smsHref} class={linkCls}>{f.number}</a>
				{:else}
					<span class={fieldValueCls}>{f.number}</span>
				{/if}
				{#if f.message}
					<pre class={preTextCls}>{f.message}</pre>
				{/if}
			</div>

		{:else if type === 'email'}
			{@const f = fields as PayloadFields['email']}
			{@const mailHref = getSafeMailtoHref(f.to)}
			<div class="flex flex-col gap-1.5">
				{#if mailHref}
					<a href={mailHref} class={linkCls}>{f.to}</a>
				{:else}
					<span class={fieldValueCls}>{f.to}</span>
				{/if}
				{#if f.subject}
					<div class="flex flex-col gap-0.5">
						<span class={fieldLabelCls}>Subject</span>
						<span class={fieldValueCls}>{f.subject}</span>
					</div>
				{/if}
				{#if f.body}
					<pre class={preTextCls}>{f.body}</pre>
				{/if}
			</div>

		{:else if type === 'vcard'}
			{@const f = fields as PayloadFields['vcard']}
			<div class="flex flex-col gap-1.5">
				<span class="{fieldValueCls} {contactNameCls}">{f.firstName} {f.lastName}</span>
				{#if f.title || f.org}
					<span class={fieldMutedCls}>{[f.title, f.org].filter(Boolean).join(' at ')}</span>
				{/if}
				{#if f.phone}
					{@const vcardPhoneHref = getSafePhoneHref(f.phone)}
					{#if vcardPhoneHref}
						<a href={vcardPhoneHref} class={linkCls}>{f.phone}</a>
					{:else}
						<span class={fieldValueCls}>{f.phone}</span>
					{/if}
				{/if}
				{#if f.email}
					{@const vcardMailHref = getSafeMailtoHref(f.email)}
					{#if vcardMailHref}
						<a href={vcardMailHref} class={linkCls}>{f.email}</a>
					{:else}
						<span class={fieldValueCls}>{f.email}</span>
					{/if}
				{/if}
				{#if f.url}
					{@const safeHref = getSafeExternalHref(f.url)}
					{#if safeHref}
						<a href={safeHref} target="_blank" rel="noopener noreferrer" class={linkCls}>{f.url}</a>
					{:else}
						<span class={fieldMutedCls}>{f.url}</span>
					{/if}
				{/if}
				{#if f.address}<span class={fieldMutedCls}>{f.address}</span>{/if}
			</div>

		{:else if type === 'calendar'}
			{@const f = fields as PayloadFields['calendar']}
			<div class="flex flex-col gap-1.5">
				<span class="{fieldValueCls} {contactNameCls}">{f.title}</span>
				{#if f.location}<span class={fieldMutedCls}>{f.location}</span>{/if}
				{#if f.start || f.end}
					<div class="flex flex-col gap-0.5">
						<span class={fieldLabelCls}>When</span>
						<span class={fieldValueCls}>{f.start} — {f.end}</span>
					</div>
				{/if}
				{#if f.description}<pre class={preTextCls}>{f.description}</pre>{/if}
			</div>

		{:else if type === 'geo'}
			{@const f = fields as PayloadFields['geo']}
			{@const geoHref = getSafeGeoHref(f.latitude, f.longitude)}
			{#if geoHref}
				<a href={geoHref} class={linkCls}>{f.latitude}, {f.longitude}</a>
			{:else}
				<span class={fieldValueCls}>{f.latitude}, {f.longitude}</span>
			{/if}

		{:else if type === 'mecard'}
			{@const f = fields as PayloadFields['mecard']}
			<div class="flex flex-col gap-1.5">
				<span class="{fieldValueCls} {contactNameCls}">{f.name}</span>
				{#if f.phone}
					{@const mecardPhoneHref = getSafePhoneHref(f.phone)}
					{#if mecardPhoneHref}
						<a href={mecardPhoneHref} class={linkCls}>{f.phone}</a>
					{:else}
						<span class={fieldValueCls}>{f.phone}</span>
					{/if}
				{/if}
				{#if f.email}
					{@const mecardMailHref = getSafeMailtoHref(f.email)}
					{#if mecardMailHref}
						<a href={mecardMailHref} class={linkCls}>{f.email}</a>
					{:else}
						<span class={fieldValueCls}>{f.email}</span>
					{/if}
				{/if}
				{#if f.url}
					{@const safeHref = getSafeExternalHref(f.url)}
					{#if safeHref}
						<a href={safeHref} target="_blank" rel="noopener noreferrer" class={linkCls}>{f.url}</a>
					{:else}
						<span class={fieldMutedCls}>{f.url}</span>
					{/if}
				{/if}
				{#if f.address}<span class={fieldMutedCls}>{f.address}</span>{/if}
				{#if f.note}<pre class={preTextCls}>{f.note}</pre>{/if}
			</div>

		{:else}
			<pre class={preTextCls}>{raw}</pre>
		{/if}
	</div>

	<div class="flex flex-wrap gap-1.5">
		<button type="button" class={actionBtnCls} onclick={() => navigator.clipboard.writeText(raw).catch(() => {})}>
			<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="8" height="8"/><path d="M4 10H3a1 1 0 01-1-1V3a1 1 0 011-1h6a1 1 0 011 1v1"/></svg>
			Copy
		</button>
		{#if type === 'vcard'}
			<button type="button" class={actionBtnCls} onclick={downloadVcf}>
				<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v8m0 0L5 7.5M8 10l3-2.5M3 12h10"/></svg>
				Save .vcf
			</button>
		{/if}
		{#if type === 'calendar'}
			<button type="button" class={actionBtnCls} onclick={downloadIcs}>
				<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v8m0 0L5 7.5M8 10l3-2.5M3 12h10"/></svg>
				Save .ics
			</button>
		{/if}
		<button type="button" class={actionBtnCls} onclick={onuse}>
			<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 7h10M8 3l4 4-4 4"/></svg>
			Use as input
		</button>
	</div>
</section>
