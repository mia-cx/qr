<script lang="ts">
	import {
		decodePayload,
		encodeCalendarPayload,
		encodeVcardPayload,
		getSafeExternalHref,
		normalizeLineEndingsForFile,
		payloadLabels,
		type PayloadType,
		type PayloadFields
	} from '$lib/qr/payloads';

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
		const blob = new Blob([content], { type: mime });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	function downloadVcf() {
		const f = fields as PayloadFields['vcard'];
		const name = `${f.firstName}_${f.lastName}`.replace(/\s+/g, '_') || 'contact';
		downloadFile(
			`${name}.vcf`,
			normalizeLineEndingsForFile(encodeVcardPayload(f)),
			'text/vcard'
		);
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
</script>

<section class="reader-result" aria-live="polite">
	<div class="result-header">
		<span class="result-type">{payloadLabels[type]}</span>
	</div>

	<div class="result-body">
		{#if type === 'url'}
			{@const f = fields as PayloadFields['url']}
			{@const safeHref = getSafeExternalHref(f.url)}
			{#if safeHref}
				<a href={safeHref} target="_blank" rel="noopener noreferrer" class="result-link">{f.url}</a>
			{:else}
				<span class="result-field-value">{f.url}</span>
			{/if}

		{:else if type === 'wifi'}
			{@const f = fields as PayloadFields['wifi']}
			<div class="result-fields">
				<div class="result-field">
					<span class="result-field-label">Network</span>
					<span class="result-field-value">{f.ssid}</span>
				</div>
				<div class="result-field">
					<span class="result-field-label">Password</span>
					<span class="result-field-value password-field">
						<span class="password-text">{showPassword ? f.password : '•'.repeat(f.password.length || 8)}</span>
						<button type="button" class="password-toggle" onclick={() => showPassword = !showPassword} aria-label={showPassword ? 'Hide password' : 'Show password'}>
							{#if showPassword}
								<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z"/><circle cx="8" cy="8" r="2"/></svg>
							{:else}
								<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z"/><circle cx="8" cy="8" r="2"/><path d="M3 13L13 3"/></svg>
							{/if}
						</button>
					</span>
				</div>
				<div class="result-field">
					<span class="result-field-label">Encryption</span>
					<span class="result-field-value">{f.encryption === 'nopass' ? 'None' : f.encryption}</span>
				</div>
				{#if f.hidden}
					<div class="result-field">
						<span class="result-field-label">Hidden</span>
						<span class="result-field-value">Yes</span>
					</div>
				{/if}
			</div>

		{:else if type === 'phone'}
			{@const f = fields as PayloadFields['phone']}
			<a href="tel:{f.number}" class="result-link">{f.number}</a>

		{:else if type === 'sms'}
			{@const f = fields as PayloadFields['sms']}
			<div class="result-fields">
				<a href="sms:{f.number}" class="result-link">{f.number}</a>
				{#if f.message}
					<pre class="result-text">{f.message}</pre>
				{/if}
			</div>

		{:else if type === 'email'}
			{@const f = fields as PayloadFields['email']}
			<div class="result-fields">
				<a href="mailto:{f.to}" class="result-link">{f.to}</a>
				{#if f.subject}
					<div class="result-field">
						<span class="result-field-label">Subject</span>
						<span class="result-field-value">{f.subject}</span>
					</div>
				{/if}
				{#if f.body}
					<pre class="result-text">{f.body}</pre>
				{/if}
			</div>

		{:else if type === 'vcard'}
			{@const f = fields as PayloadFields['vcard']}
			<div class="result-fields">
				<span class="result-field-value contact-name">{f.firstName} {f.lastName}</span>
				{#if f.title || f.org}
					<span class="result-field-muted">{[f.title, f.org].filter(Boolean).join(' at ')}</span>
				{/if}
				{#if f.phone}<a href="tel:{f.phone}" class="result-link">{f.phone}</a>{/if}
				{#if f.email}<a href="mailto:{f.email}" class="result-link">{f.email}</a>{/if}
				{#if f.url}
					{@const safeHref = getSafeExternalHref(f.url)}
					{#if safeHref}
						<a href={safeHref} target="_blank" rel="noopener noreferrer" class="result-link">{f.url}</a>
					{:else}
						<span class="result-field-muted">{f.url}</span>
					{/if}
				{/if}
				{#if f.address}<span class="result-field-muted">{f.address}</span>{/if}
			</div>

		{:else if type === 'calendar'}
			{@const f = fields as PayloadFields['calendar']}
			<div class="result-fields">
				<span class="result-field-value contact-name">{f.title}</span>
				{#if f.location}<span class="result-field-muted">{f.location}</span>{/if}
				{#if f.start || f.end}
					<div class="result-field">
						<span class="result-field-label">When</span>
						<span class="result-field-value">{f.start} — {f.end}</span>
					</div>
				{/if}
				{#if f.description}<pre class="result-text">{f.description}</pre>{/if}
			</div>

		{:else if type === 'geo'}
			{@const f = fields as PayloadFields['geo']}
			<a href="geo:{f.latitude},{f.longitude}" class="result-link">{f.latitude}, {f.longitude}</a>

		{:else if type === 'mecard'}
			{@const f = fields as PayloadFields['mecard']}
			<div class="result-fields">
				<span class="result-field-value contact-name">{f.name}</span>
				{#if f.phone}<a href="tel:{f.phone}" class="result-link">{f.phone}</a>{/if}
				{#if f.email}<a href="mailto:{f.email}" class="result-link">{f.email}</a>{/if}
				{#if f.url}
					{@const safeHref = getSafeExternalHref(f.url)}
					{#if safeHref}
						<a href={safeHref} target="_blank" rel="noopener noreferrer" class="result-link">{f.url}</a>
					{:else}
						<span class="result-field-muted">{f.url}</span>
					{/if}
				{/if}
				{#if f.address}<span class="result-field-muted">{f.address}</span>{/if}
				{#if f.note}<pre class="result-text">{f.note}</pre>{/if}
			</div>

		{:else}
			<pre class="result-text">{raw}</pre>
		{/if}
	</div>

	<div class="result-actions">
		<button type="button" class="action-btn" onclick={() => navigator.clipboard.writeText(raw)}>
			<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="8" height="8"/><path d="M4 10H3a1 1 0 01-1-1V3a1 1 0 011-1h6a1 1 0 011 1v1"/></svg>
			Copy
		</button>
		{#if type === 'vcard'}
			<button type="button" class="action-btn" onclick={downloadVcf}>
				<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v8m0 0L5 7.5M8 10l3-2.5M3 12h10"/></svg>
				Save .vcf
			</button>
		{/if}
		{#if type === 'calendar'}
			<button type="button" class="action-btn" onclick={downloadIcs}>
				<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v8m0 0L5 7.5M8 10l3-2.5M3 12h10"/></svg>
				Save .ics
			</button>
		{/if}
		<button type="button" class="action-btn" onclick={onuse}>
			<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 7h10M8 3l4 4-4 4"/></svg>
			Use as input
		</button>
	</div>
</section>

<style>
	.reader-result {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.result-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.result-type {
		font-family: 'Oxanium', sans-serif;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--muted-foreground);
		padding: 0.125rem 0.375rem;
		border: 1px solid var(--border);
		background: var(--secondary);
	}

	.result-body {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.result-fields {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.result-field {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.result-field-label {
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--muted-foreground);
	}

	.result-field-value {
		font-size: 0.85rem;
		color: var(--foreground);
	}

	.result-field-muted {
		font-size: 0.8rem;
		color: var(--muted-foreground);
	}

	.contact-name {
		font-family: 'Oxanium', sans-serif;
		font-weight: 600;
		font-size: 0.95rem;
	}

	.result-link {
		color: var(--foreground);
		text-decoration: underline;
		text-underline-offset: 2px;
		font-size: 0.85rem;
		word-break: break-all;
	}

	.result-link:hover {
		color: var(--muted-foreground);
	}

	.result-text {
		padding: 0.5rem;
		background: var(--secondary);
		border: 1px solid var(--border);
		font-size: 0.8rem;
		color: var(--foreground);
		white-space: pre-wrap;
		word-break: break-all;
		margin: 0;
	}

	.password-field {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.5rem;
		background: var(--secondary);
		border: 1px solid var(--border);
		font-size: 0.85rem;
	}

	.password-text {
		flex: 1;
		font-family: 'DM Sans Variable', monospace;
	}

	.password-toggle {
		all: unset;
		cursor: pointer;
		color: var(--muted-foreground);
		display: flex;
		align-items: center;
		padding: 0.125rem;
	}

	.password-toggle:hover {
		color: var(--foreground);
	}

	.result-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.action-btn {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.625rem;
		background: var(--secondary);
		border: 1px solid var(--border);
		color: var(--foreground);
		font-size: 0.75rem;
		cursor: pointer;
		transition: background 0.12s ease;
	}

	.action-btn:hover {
		background: var(--accent);
	}
</style>
