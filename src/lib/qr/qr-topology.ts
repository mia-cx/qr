import qrcode from 'qrcode-generator';

import type { ErrorCorrectionLevel, GridPoint, QRModules, StrokeGraph } from './qr-core';

type Edge = `${number},${number}-${number},${number}`;
type EdgeDirection = 'horizontal' | 'vertical';
type NodeKey = `${number},${number}`;

interface EdgeCandidate {
	key: Edge;
	row: number;
	col: number;
	direction: EdgeDirection;
}

interface SingleEntryCache<T> {
	key: string;
	value: T;
}

let modulesCache: SingleEntryCache<QRModules> | null = null;
let connectorEdgesCache: SingleEntryCache<Set<Edge>> | null = null;
let allAdjacentEdgesCache: SingleEntryCache<Set<Edge>> | null = null;
let strokeGraphCache: SingleEntryCache<StrokeGraph> | null = null;

function createQRModules(data: string, errorCorrection: ErrorCorrectionLevel): QRModules {
	const qr = qrcode(0, errorCorrection);
	qr.addData(data);
	qr.make();
	return {
		count: qr.getModuleCount(),
		isDark: (row: number, col: number) => qr.isDark(row, col)
	};
}

export function qrTopologyKey(data: string, errorCorrection: ErrorCorrectionLevel): string {
	return `${errorCorrection}\u0000${data}`;
}

export function generateQRModules(data: string, errorCorrection: ErrorCorrectionLevel): QRModules {
	const key = qrTopologyKey(data, errorCorrection);
	if (modulesCache?.key === key) {
		return modulesCache.value;
	}

	const modules = createQRModules(data, errorCorrection);
	modulesCache = { key, value: modules };
	return modules;
}

export function getAdj(
	row: number,
	col: number,
	count: number,
	isDark: (r: number, c: number) => boolean
) {
	return {
		top: row > 0 && isDark(row - 1, col),
		right: col < count - 1 && isDark(row, col + 1),
		bottom: row < count - 1 && isDark(row + 1, col),
		left: col > 0 && isDark(row, col - 1)
	};
}

function edgeKey(r1: number, c1: number, r2: number, c2: number): Edge {
	return `${r1},${c1}-${r2},${c2}`;
}

function nodeKey(row: number, col: number): NodeKey {
	return `${row},${col}`;
}

function parseNodeKey(key: NodeKey): GridPoint {
	const [row, col] = key.split(',').map(Number);
	return { row, col };
}

function graphEdgeKey(a: NodeKey, b: NodeKey): string {
	return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Deterministic pick seeded by grid position. */
function posHash(row: number, col: number): number {
	let h = row * 7919 + col * 104729;
	h = ((h >>> 16) ^ h) * 0x45d9f3b;
	return ((h >>> 16) ^ h) >>> 0;
}

/**
 * Give edges a deterministic but non-grid-like order so we get a little
 * variation without ever needing an unbounded retry loop.
 */
function edgePriority(candidate: EdgeCandidate): number {
	const endRow = candidate.direction === 'horizontal' ? candidate.row : candidate.row + 1;
	const endCol = candidate.direction === 'horizontal' ? candidate.col + 1 : candidate.col;
	const start = posHash(candidate.row, candidate.col);
	const end = posHash(endRow, endCol);
	const directionSalt = candidate.direction === 'horizontal' ? 0x9e3779b1 : 0x85ebca6b;

	return (start ^ ((end << 1) | (end >>> 31)) ^ directionSalt) >>> 0;
}

function collectAdjacentEdgeCandidates(
	count: number,
	isDark: (r: number, c: number) => boolean
): EdgeCandidate[] {
	const candidates: EdgeCandidate[] = [];

	for (let row = 0; row < count; row++) {
		for (let col = 0; col < count; col++) {
			if (!isDark(row, col)) continue;
			if (col < count - 1 && isDark(row, col + 1)) {
				candidates.push({
					key: edgeKey(row, col, row, col + 1),
					row,
					col,
					direction: 'horizontal'
				});
			}
			if (row < count - 1 && isDark(row + 1, col)) {
				candidates.push({
					key: edgeKey(row, col, row + 1, col),
					row,
					col,
					direction: 'vertical'
				});
			}
		}
	}

	return candidates;
}

function getLoopEdges(row: number, col: number): [Edge, Edge, Edge, Edge] {
	return [
		edgeKey(row, col, row, col + 1),
		edgeKey(row, col + 1, row + 1, col + 1),
		edgeKey(row + 1, col, row + 1, col + 1),
		edgeKey(row, col, row + 1, col)
	];
}

function isSolidTwoByTwo(
	row: number,
	col: number,
	count: number,
	isDark: (r: number, c: number) => boolean
): boolean {
	return (
		row >= 0 &&
		row < count - 1 &&
		col >= 0 &&
		col < count - 1 &&
		isDark(row, col) &&
		isDark(row, col + 1) &&
		isDark(row + 1, col) &&
		isDark(row + 1, col + 1)
	);
}

function wouldCloseTwoByTwo(
	candidate: EdgeCandidate,
	edges: ReadonlySet<Edge>,
	count: number,
	isDark: (r: number, c: number) => boolean
): boolean {
	const possibleLoops =
		candidate.direction === 'horizontal'
			? [
					[candidate.row, candidate.col],
					[candidate.row - 1, candidate.col]
				]
			: [
					[candidate.row, candidate.col],
					[candidate.row, candidate.col - 1]
				];

	for (const [row, col] of possibleLoops) {
		if (!isSolidTwoByTwo(row, col, count, isDark)) {
			continue;
		}

		const otherEdges = getLoopEdges(row, col).filter((edge) => edge !== candidate.key);
		if (otherEdges.every((edge) => edges.has(edge))) {
			return true;
		}
	}

	return false;
}

function buildConnectorEdges(count: number, isDark: (r: number, c: number) => boolean): Set<Edge> {
	const candidates = collectAdjacentEdgeCandidates(count, isDark);

	candidates.sort((a, b) => {
		const priorityDiff = edgePriority(a) - edgePriority(b);
		if (priorityDiff !== 0) {
			return priorityDiff;
		}

		return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
	});

	const edges = new Set<Edge>();

	for (const candidate of candidates) {
		if (!wouldCloseTwoByTwo(candidate, edges, count, isDark)) {
			edges.add(candidate.key);
		}
	}

	return edges;
}

function buildAllAdjacentEdges(
	count: number,
	isDark: (r: number, c: number) => boolean
): Set<Edge> {
	return new Set(collectAdjacentEdgeCandidates(count, isDark).map(({ key }) => key));
}

export function getAllAdjacentEdges(
	cacheKey: string,
	count: number,
	isDark: (r: number, c: number) => boolean
): Set<Edge> {
	if (allAdjacentEdgesCache?.key === cacheKey) {
		return allAdjacentEdgesCache.value;
	}

	const edges = buildAllAdjacentEdges(count, isDark);
	allAdjacentEdgesCache = { key: cacheKey, value: edges };
	return edges;
}

export function getConnectorEdges(
	cacheKey: string,
	count: number,
	isDark: (r: number, c: number) => boolean
): Set<Edge> {
	if (connectorEdgesCache?.key === cacheKey) {
		return connectorEdgesCache.value;
	}

	const edges = buildConnectorEdges(count, isDark);
	connectorEdgesCache = { key: cacheKey, value: edges };
	return edges;
}

function traceStrokeGraph(
	count: number,
	isDark: (r: number, c: number) => boolean,
	preventClosedLoops: boolean
): StrokeGraph {
	const edges = preventClosedLoops
		? buildConnectorEdges(count, isDark)
		: buildAllAdjacentEdges(count, isDark);
	const adjacency = new Map<NodeKey, Set<NodeKey>>();

	for (let row = 0; row < count; row++) {
		for (let col = 0; col < count; col++) {
			if (!isDark(row, col)) continue;
			adjacency.set(nodeKey(row, col), new Set());
		}
	}

	for (const edge of edges) {
		const [from, to] = edge.split('-') as [NodeKey, NodeKey];
		adjacency.get(from)?.add(to);
		adjacency.get(to)?.add(from);
	}

	const visitedEdges = new Set<string>();
	const paths: StrokeGraph['paths'] = [];
	const sortedNodes = [...adjacency.keys()].sort();

	const sortedNeighbors = (key: NodeKey) => [...(adjacency.get(key) ?? [])].sort();

	const traceOpenPath = (start: NodeKey, next: NodeKey) => {
		const points = [parseNodeKey(start), parseNodeKey(next)];
		visitedEdges.add(graphEdgeKey(start, next));

		let previous = start;
		let current = next;

		while ((adjacency.get(current)?.size ?? 0) === 2) {
			const candidate = sortedNeighbors(current).find(
				(neighbor) =>
					neighbor !== previous && !visitedEdges.has(graphEdgeKey(current, neighbor as NodeKey))
			) as NodeKey | undefined;

			if (!candidate) break;

			visitedEdges.add(graphEdgeKey(current, candidate));
			points.push(parseNodeKey(candidate));
			previous = current;
			current = candidate;
		}

		return { points, closed: false };
	};

	const traceClosedPath = (start: NodeKey, next: NodeKey) => {
		const points = [parseNodeKey(start), parseNodeKey(next)];
		visitedEdges.add(graphEdgeKey(start, next));

		let previous = start;
		let current = next;

		while (current !== start) {
			const candidates = sortedNeighbors(current).filter(
				(neighbor) => neighbor !== previous
			) as NodeKey[];
			const candidate =
				candidates.find((neighbor) => !visitedEdges.has(graphEdgeKey(current, neighbor))) ??
				candidates[0];

			if (!candidate) break;

			visitedEdges.add(graphEdgeKey(current, candidate));
			if (candidate === start) break;

			points.push(parseNodeKey(candidate));
			previous = current;
			current = candidate;
		}

		return { points, closed: true };
	};

	for (const key of sortedNodes) {
		const degree = adjacency.get(key)?.size ?? 0;
		if (degree === 0 || degree === 2) continue;

		for (const neighbor of sortedNeighbors(key)) {
			if (visitedEdges.has(graphEdgeKey(key, neighbor))) continue;
			paths.push(traceOpenPath(key, neighbor as NodeKey));
		}
	}

	for (const key of sortedNodes) {
		for (const neighbor of sortedNeighbors(key)) {
			if (visitedEdges.has(graphEdgeKey(key, neighbor))) continue;
			paths.push(traceClosedPath(key, neighbor as NodeKey));
		}
	}

	const isolated = sortedNodes
		.filter((key) => (adjacency.get(key)?.size ?? 0) === 0)
		.map((key) => parseNodeKey(key));

	return { paths, isolated };
}

export function getStrokeGraph(
	cacheKey: string,
	count: number,
	isDark: (r: number, c: number) => boolean,
	preventClosedLoops: boolean
): StrokeGraph {
	const strokeCacheKey = `${cacheKey}\u0001${preventClosedLoops ? 'pruned' : 'full'}`;
	if (strokeGraphCache?.key === strokeCacheKey) {
		return strokeGraphCache.value;
	}

	const graph = traceStrokeGraph(count, isDark, preventClosedLoops);
	strokeGraphCache = { key: strokeCacheKey, value: graph };
	return graph;
}

export function buildConnectorEdgesFromMatrix(matrix: boolean[][]): Set<Edge> {
	return buildConnectorEdges(matrix.length, (row, col) => matrix[row]?.[col] ?? false);
}

export function buildAllAdjacentEdgesFromMatrix(matrix: boolean[][]): Set<Edge> {
	return buildAllAdjacentEdges(matrix.length, (row, col) => matrix[row]?.[col] ?? false);
}

export function traceStrokeGraphFromMatrix(
	matrix: boolean[][],
	preventClosedLoops = true
): StrokeGraph {
	return traceStrokeGraph(
		matrix.length,
		(row, col) => matrix[row]?.[col] ?? false,
		preventClosedLoops
	);
}
