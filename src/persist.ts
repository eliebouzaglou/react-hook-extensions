import {
    dehydrate,
    hydrate,
    type DehydratedState,
    type Query,
    type QueryClient,
    type QueryMeta,
} from "@tanstack/react-query";
import { warnOnce } from "./warn";

export const DEFAULT_STORAGE_KEY = "react-hook-extensions";
export const PERSIST_SOURCE = "react-hook-extensions";

type Written = { current: string | null };

export function persistedCacheFor(meta: QueryMeta | undefined): number | undefined {
    if (!meta) return undefined;
    if (meta.persist !== true || meta.source !== PERSIST_SOURCE) return undefined;
    if (typeof meta.cacheFor !== "number" || !Number.isFinite(meta.cacheFor) || meta.cacheFor < 0) {
        return undefined;
    }
    return meta.cacheFor;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isFreshStoredQuery(value: unknown, now: number): value is DehydratedState["queries"][number] {
    if (!isRecord(value) || !isRecord(value.state) || !isRecord(value.meta)) return false;
    if (value.meta.persist !== true || value.meta.source !== PERSIST_SOURCE) return false;
    if (typeof value.meta.cacheFor !== "number" || !Number.isFinite(value.meta.cacheFor)) return false;
    if (typeof value.state.dataUpdatedAt !== "number") return false;
    return now - value.state.dataUpdatedAt <= value.meta.cacheFor;
}

export function readPersistedState(raw: string, now: number): DehydratedState | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!isRecord(parsed) || !Array.isArray(parsed.queries)) return null;
    return {
        mutations: [],
        queries: parsed.queries.filter((query) => isFreshStoredQuery(query, now)),
    };
}

function isFreshRuntimeQuery(query: Query, now: number): boolean {
    const cacheFor = persistedCacheFor(query.meta);
    if (cacheFor === undefined) return false;
    if (query.state.status !== "success") return false;
    return now - query.state.dataUpdatedAt <= cacheFor;
}

/**
 * TanStack Query's gcTime only ever grows, and queries created by `hydrate`
 * start at the 5 minute default. Pin the lifetime back to this entry's `cacheFor`.
 */
function alignGcTime(query: Query, cacheFor: number): void {
    const entry = query as Query & { gcTime?: number; scheduleGc?: () => void };
    entry.gcTime = cacheFor;
    if (query.observers.length === 0) entry.scheduleGc?.();
}

export function loadPersistedCache(client: QueryClient, storage: Storage, storageKey: string, lastWritten: Written, now = Date.now()): void {
    let raw: string | null;
    try {
        raw = storage.getItem(storageKey);
    } catch {
        return;
    }
    if (!raw) return;

    const state = readPersistedState(raw, now);
    if (!state) {
        try {
            storage.removeItem(storageKey);
        } catch {
            // Storage can throw in private mode. The in-memory cache still works.
        }
        return;
    }

    hydrate(client, state);
    for (const query of client.getQueryCache().getAll()) {
        const cacheFor = persistedCacheFor(query.meta);
        if (cacheFor !== undefined) alignGcTime(query, cacheFor);
    }

    const json = JSON.stringify(state);
    lastWritten.current = json;
    if (json === raw) return;
    try {
        if (state.queries.length === 0) storage.removeItem(storageKey);
        else storage.setItem(storageKey, json);
    } catch {
        // Ignore quota and privacy errors. The restored memory value still stands.
    }
}

export function savePersistedCache(client: QueryClient, storage: Storage, storageKey: string, lastWritten: Written, now = Date.now()): void {
    try {
        const state = dehydrate(client, {
            shouldDehydrateMutation: () => false,
            shouldDehydrateQuery: (query) => isFreshRuntimeQuery(query, now),
        });
        if (state.queries.length === 0) {
            if (lastWritten.current !== null) {
                storage.removeItem(storageKey);
                lastWritten.current = null;
            }
            return;
        }
        const json = JSON.stringify(state);
        if (json === lastWritten.current) return;
        storage.setItem(storageKey, json);
        lastWritten.current = json;
    } catch (error) {
        warnOnce(
            `react-hook-extensions: could not save the persisted cache (${error instanceof Error ? error.message : "unknown error"}). Values passed to useCache({ persist: true }) must be JSON-serializable.`,
        );
    }
}
