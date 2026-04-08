export type StudioSection = 'generate' | 'read';

const STUDIO_ROUTE_SECTIONS: Record<string, StudioSection> = {
	'/create': 'generate',
	'/read': 'read'
};

function normalizeTrailingSlash(pathname: string): string {
	if (pathname.length > 1 && pathname.endsWith('/')) {
		return pathname.slice(0, -1);
	}

	return pathname;
}

export function getStudioSectionForPath(pathname: string): StudioSection | null {
	return STUDIO_ROUTE_SECTIONS[normalizeTrailingSlash(pathname)] ?? null;
}

export function normalizeStudioRoutePath(pathname: string): string {
	return getStudioSectionForPath(pathname) ? '/' : pathname;
}
