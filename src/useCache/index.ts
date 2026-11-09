"use client";

import { useCallback, useContext, useMemo, useRef } from "react";
import { QueryClient, QueryClientContext, useIsRestoring, useQuery } from "@tanstack/react-query";
import { type CacheKey } from "../index";
import { PersistenceEnabledContext } from "../context";
import { PERSIST_SOURCE } from "../persist";
import { warnOnce } from "../warn";

const QUERY_KEY_PREFIX = "react-hook-extensions";

export type CacheSetter<T> = (value: T | ((prev: T) => T)) => void;

export type UseCacheResult<T> = readonly [T, CacheSetter<T>];

export type UseCacheOptions<K extends string = CacheKey> =
    | {
          key: K;
          /**
           * How long to keep the value after nothing is using it, in milliseconds.
           * Once that time passes, the next read returns `initial`.
           * @default Infinity
           */
          cacheFor?: number;
          persist?: false;
      }
    | {
          key: K;
          /**
           * How long a saved value may be restored, measured from the last write.
           * Also how long it stays in memory after nothing is using it.
           * Must be finite. `Infinity` throws.
           */
          cacheFor: number;
          /** Save this value in storage and restore it on a later visit. */
          persist: true;
      };

export function useCache<T, K extends CacheKey = CacheKey>(
    initial: T,
    options: UseCacheOptions<K>,
): UseCacheResult<T> {
    const contextClient = useContext(QueryClientContext);
    const isRestoring = useIsRestoring();
    const persistenceEnabled = useContext(PersistenceEnabledContext);
    const initialRef = useRef(initial);
    initialRef.current = initial;
    const fallbackRef = useRef<QueryClient | null>(null);

    const persist = options.persist === true;
    const cacheFor = options.cacheFor;
    const key = typeof options.key === "string" ? options.key : "";
    const queryKey = useMemo(() => [QUERY_KEY_PREFIX, key] as const, [key]);
    const optionsError = cacheOptionsError(key, persist, cacheFor);
    const queryClient = contextClient ?? fallbackClient(fallbackRef);

    const { data } = useQuery(
        {
            queryKey,
            queryFn: () => initialRef.current,
            staleTime: Infinity,
            gcTime: usableGcTime(cacheFor),
            networkMode: "always",
            retry: false,
            refetchOnMount: false,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            enabled: optionsError === null && contextClient !== undefined && (!persist || !isRestoring),
            ...(persist && typeof cacheFor === "number" && Number.isFinite(cacheFor)
                ? { meta: { persist: true, source: PERSIST_SOURCE, cacheFor } }
                : {}),
            // Persisted queries must not write `initial` into the cache before restore
            // finishes, or the saved value loses to a newer timestamp. `data === undefined`
            // still shows `initial` until the saved value arrives.
            ...(!persist ? { initialData: initial } : {}),
        },
        queryClient,
    );

    const setData = useCallback<CacheSetter<T>>(
        (value) => {
            queryClient.setQueryData<T>(queryKey, (prev) => {
                const current = prev === undefined ? initialRef.current : prev;
                return typeof value === "function" ? (value as (prev: T) => T)(current) : value;
            });
        },
        [queryClient, queryKey],
    );

    if (!contextClient) {
        throw new Error("useCache must be used within <HookExtensionsProvider>.");
    }
    if (optionsError) throw new Error(optionsError);
    if (persist && !persistenceEnabled) {
        warnOnce(
            `useCache: "${key}" is marked persist but <HookExtensionsProvider persist> is not mounted. The value stays in memory for this visit only.`,
        );
    }

    const safeData = data === undefined ? initial : data;
    return [safeData, setData];
}

function fallbackClient(ref: { current: QueryClient | null }): QueryClient {
    if (ref.current === null) {
        ref.current = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });
    }
    return ref.current;
}

function usableGcTime(cacheFor: number | undefined): number {
    if (cacheFor === undefined || cacheFor === Infinity) return Infinity;
    if (Number.isFinite(cacheFor) && cacheFor >= 0) return cacheFor;
    return Infinity;
}

function cacheOptionsError(key: string, persist: boolean, cacheFor: number | undefined): string | null {
    if (key.length === 0) return "useCache: key must be a non-empty string.";
    if (persist) {
        if (cacheFor === undefined || !Number.isFinite(cacheFor) || cacheFor < 0) {
            return "useCache: persist requires cacheFor to be a finite number of milliseconds greater than or equal to 0.";
        }
        return null;
    }
    if (cacheFor !== undefined && cacheFor !== Infinity && (!Number.isFinite(cacheFor) || cacheFor < 0)) {
        return "useCache: cacheFor must be Infinity or a finite number of milliseconds greater than or equal to 0.";
    }
    return null;
}
