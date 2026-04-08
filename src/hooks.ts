import type { Reroute } from '@sveltejs/kit';
import { deLocalizeUrl } from '$lib/paraglide/runtime';
import { normalizeStudioRoutePath } from '$lib/routes/studio';

export const reroute: Reroute = (request) =>
	normalizeStudioRoutePath(deLocalizeUrl(request.url).pathname);
