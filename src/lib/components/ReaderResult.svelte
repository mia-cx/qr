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
		type PayloadFields
	} from '$lib/qr/payloads';
	import { downloadBlob } from '$lib/utils';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';

	interface Props {
		raw: string;
		onuse: () => void;
	}

	let { raw, onuse }: Props = $props();

	let showPassword = $state(false);

	const decoded = $derived(decodePayload(raw));
	const type = $derived(decoded.type);
	const fields = $derived(decoded.fields);

	function downloadFile(filename: string, content: string, mime: string) {
		downloadBlob(new Blob([content], { type: mime }), filename);
	}

	function downloadVcf() {
		const f = fields as PayloadFields['vcard'];
		const name = `${f.firstName}_${f.lastName}`.replace(/\s+/g, '_') || 'contact';
		downloadFile(`${name}.vcf`, normalizeLineEndingsForFile(encodeVcardPayload(f)), 'text/vcard');
	}

	function downloadIcs() {
		const f = fields as PayloadFields['calendar'];
		const name = f.title.replace(/\s+/g, '_') || 'event';
		downloadFile(
			`${name}.ics`,
			normalizeLineEndingsForFile(encodeCalendarPayload(f)),
			'text/calendar'
		);
	}

	const typeBadgeCls =
		'inline-flex w-fit border border-border bg-secondary px-1.5 py-0.5 font-heading text-[0.7rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground';
	const bodyCls = 'flex flex-col gap-1';
	const fieldsCls = 'flex flex-col gap-1.5';
	const fieldCls = 'flex flex-col gap-0.5';
	const fieldLabelCls =
		'text-[0.65rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground';
	const fieldValueCls = 'text-[0.85rem] text-foreground';
	const fieldMutedCls = 'text-[0.8rem] text-muted-foreground';
	const nameCls = 'font-heading text-[0.95rem] font-semibold text-foreground';
	const linkCls =
		'break-all text-[0.85rem] text-foreground underline underline-offset-2 transition-colors hover:text-muted-foreground';
	const textBlockCls =
		'm-0 whitespace-pre-wrap break-all border border-border bg-secondary p-2 text-[0.8rem] text-foreground';
	const actionBtnCls =
		'inline-flex items-center gap-1.5 border border-border bg-secondary px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2';
</script>

<section class="flex flex-col gap-2" aria-live="polite">
	<div class="flex items-center gap-2">
		<span class={typeBadgeCls}>{payloadLabels[type]}</span>
	</div>

	<div class={bodyCls}>
		{#if type === 'url'}
			{@const f = fields as PayloadFields['url']}
			{@const safeHref = getSafeExternalHref(f.url)}
			{#if safeHref}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
				<a href={safeHref} target="_blank" rel="noopener noreferrer" class={linkCls}>{f.url}</a>
			{:else}
				<span class={fieldValueCls}>{f.url}</span>
			{/if}
		{:else if type === 'wifi'}
			{@const f = fields as PayloadFields['wifi']}
			<div class={fieldsCls}>
				<div class={fieldCls}>
					<span class={fieldLabelCls}>Network</span>
					<span class={fieldValueCls}>{f.ssid}</span>
				</div>
				<div class={fieldCls}>
					<span class={fieldLabelCls}>Password</span>
					<span
						class="flex items-center gap-1.5 border border-border bg-secondary px-2 py-1.5 text-[0.85rem] text-foreground"
					>
						<span class="flex-1 font-mono"
							>{showPassword ? f.password : '•'.repeat(f.password.length || 8)}</span
						>
						<button
							type="button"
							class="inline-flex items-center p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
							onclick={() => (showPassword = !showPassword)}
							aria-label={showPassword ? 'Hide password' : 'Show password'}
						>
							{#if showPassword}
								<EyeOffIcon class="size-3.5" strokeWidth={1.5} />
							{:else}
								<EyeIcon class="size-3.5" strokeWidth={1.5} />
							{/if}
						</button>
					</span>
				</div>
				<div class={fieldCls}>
					<span class={fieldLabelCls}>Encryption</span>
					<span class={fieldValueCls}>{f.encryption === 'nopass' ? 'None' : f.encryption}</span>
				</div>
				{#if f.hidden}
					<div class={fieldCls}>
						<span class={fieldLabelCls}>Hidden</span>
						<span class={fieldValueCls}>Yes</span>
					</div>
				{/if}
			</div>
		{:else if type === 'phone'}
			{@const f = fields as PayloadFields['phone']}
			{@const phoneHref = getSafePhoneHref(f.number)}
			{#if phoneHref}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
				<a href={phoneHref} class={linkCls}>{f.number}</a>
			{:else}
				<span class={fieldValueCls}>{f.number}</span>
			{/if}
		{:else if type === 'sms'}
			{@const f = fields as PayloadFields['sms']}
			{@const smsHref = getSafeSmsHref(f.number)}
			<div class={fieldsCls}>
				{#if smsHref}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a href={smsHref} class={linkCls}>{f.number}</a>
				{:else}
					<span class={fieldValueCls}>{f.number}</span>
				{/if}
				{#if f.message}
					<pre class={textBlockCls}>{f.message}</pre>
				{/if}
			</div>
		{:else if type === 'email'}
			{@const f = fields as PayloadFields['email']}
			{@const mailHref = getSafeMailtoHref(f.to)}
			<div class={fieldsCls}>
				{#if mailHref}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a href={mailHref} class={linkCls}>{f.to}</a>
				{:else}
					<span class={fieldValueCls}>{f.to}</span>
				{/if}
				{#if f.subject}
					<div class={fieldCls}>
						<span class={fieldLabelCls}>Subject</span>
						<span class={fieldValueCls}>{f.subject}</span>
					</div>
				{/if}
				{#if f.body}
					<pre class={textBlockCls}>{f.body}</pre>
				{/if}
			</div>
		{:else if type === 'vcard'}
			{@const f = fields as PayloadFields['vcard']}
			<div class={fieldsCls}>
				<span class={nameCls}>{f.firstName} {f.lastName}</span>
				{#if f.title || f.org}
					<span class={fieldMutedCls}>{[f.title, f.org].filter(Boolean).join(' at ')}</span>
				{/if}
				{#if f.phone}
					{@const vcardPhoneHref = getSafePhoneHref(f.phone)}
					{#if vcardPhoneHref}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<a href={vcardPhoneHref} class={linkCls}>{f.phone}</a>
					{:else}
						<span class={fieldValueCls}>{f.phone}</span>
					{/if}
				{/if}
				{#if f.email}
					{@const vcardMailHref = getSafeMailtoHref(f.email)}
					{#if vcardMailHref}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<a href={vcardMailHref} class={linkCls}>{f.email}</a>
					{:else}
						<span class={fieldValueCls}>{f.email}</span>
					{/if}
				{/if}
				{#if f.url}
					{@const safeHref = getSafeExternalHref(f.url)}
					{#if safeHref}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<a href={safeHref} target="_blank" rel="noopener noreferrer" class={linkCls}>{f.url}</a>
					{:else}
						<span class={fieldMutedCls}>{f.url}</span>
					{/if}
				{/if}
				{#if f.address}<span class={fieldMutedCls}>{f.address}</span>{/if}
			</div>
		{:else if type === 'calendar'}
			{@const f = fields as PayloadFields['calendar']}
			<div class={fieldsCls}>
				<span class={nameCls}>{f.title}</span>
				{#if f.location}<span class={fieldMutedCls}>{f.location}</span>{/if}
				{#if f.start || f.end}
					<div class={fieldCls}>
						<span class={fieldLabelCls}>When</span>
						<span class={fieldValueCls}>{f.start} — {f.end}</span>
					</div>
				{/if}
				{#if f.description}<pre class={textBlockCls}>{f.description}</pre>{/if}
			</div>
		{:else if type === 'geo'}
			{@const f = fields as PayloadFields['geo']}
			{@const geoHref = getSafeGeoHref(f.latitude, f.longitude)}
			{#if geoHref}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
				<a href={geoHref} class={linkCls}>{f.latitude}, {f.longitude}</a>
			{:else}
				<span class={fieldValueCls}>{f.latitude}, {f.longitude}</span>
			{/if}
		{:else if type === 'mecard'}
			{@const f = fields as PayloadFields['mecard']}
			<div class={fieldsCls}>
				<span class={nameCls}>{f.name}</span>
				{#if f.phone}
					{@const mecardPhoneHref = getSafePhoneHref(f.phone)}
					{#if mecardPhoneHref}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<a href={mecardPhoneHref} class={linkCls}>{f.phone}</a>
					{:else}
						<span class={fieldValueCls}>{f.phone}</span>
					{/if}
				{/if}
				{#if f.email}
					{@const mecardMailHref = getSafeMailtoHref(f.email)}
					{#if mecardMailHref}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<a href={mecardMailHref} class={linkCls}>{f.email}</a>
					{:else}
						<span class={fieldValueCls}>{f.email}</span>
					{/if}
				{/if}
				{#if f.url}
					{@const safeHref = getSafeExternalHref(f.url)}
					{#if safeHref}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<a href={safeHref} target="_blank" rel="noopener noreferrer" class={linkCls}>{f.url}</a>
					{:else}
						<span class={fieldMutedCls}>{f.url}</span>
					{/if}
				{/if}
				{#if f.address}<span class={fieldMutedCls}>{f.address}</span>{/if}
				{#if f.note}<pre class={textBlockCls}>{f.note}</pre>{/if}
			</div>
		{:else}
			<pre class={textBlockCls}>{raw}</pre>
		{/if}
	</div>

	<div class="flex flex-wrap gap-1.5">
		<button
			type="button"
			class={actionBtnCls}
			onclick={() => navigator.clipboard.writeText(raw).catch(() => {})}
		>
			<CopyIcon class="size-3.5" strokeWidth={1.5} />
			Copy
		</button>
		{#if type === 'vcard'}
			<button type="button" class={actionBtnCls} onclick={downloadVcf}>
				<DownloadIcon class="size-3.5" strokeWidth={1.5} />
				Save .vcf
			</button>
		{/if}
		{#if type === 'calendar'}
			<button type="button" class={actionBtnCls} onclick={downloadIcs}>
				<DownloadIcon class="size-3.5" strokeWidth={1.5} />
				Save .ics
			</button>
		{/if}
		<button type="button" class={actionBtnCls} onclick={onuse}>
			<ArrowRightIcon class="size-3.5" strokeWidth={1.5} />
			Use as input
		</button>
	</div>
</section>
