"use client";
import { useCallback } from 'react';
import { useQuery, useQueryClient, useIsRestoring } from '@tanstack/react-query';

import type { CacheKeys } from '../config/re-exports';

type UseCacheOptions =
    | {
        key: CacheKeys; // if you want to add a new key, add it in the types first
        /**
         * How long to keep the value after nothing is using it, in milliseconds.
         * Once that time passes, the next read returns `initial`.
         * @default Infinity
         */
        cacheFor?: number;
        persist?: false;
    }
    | {
        key: CacheKeys;
        /**
         * How long a saved value may be restored, measured from the last write.
         * Also how long it stays in memory after nothing is using it.
         * Must be finite. `Infinity` throws.
         */
        cacheFor: number;
        /** Save this value in localStorage and restore it on a later visit. */
        persist: true;
    };
/**
 * useState that persists when you switch pages
 */
export function useCache<T>(initial: T, options: UseCacheOptions) {
    const queryKey = Array.isArray(options.key) ? options.key : [options.key];
    const queryClient = useQueryClient();
    const isRestoring = useIsRestoring();
    const persist = options.persist === true;

    if (persist && !Number.isFinite(options.cacheFor)) {
        throw new Error("useCache: persist requires a finite cacheFor");
    }

    const gcTime = options.cacheFor ?? Infinity;

    const { data } = useQuery({
        queryKey,
        queryFn: () => initial,
        staleTime: Infinity,
        gcTime,
        // Persisted queries must not write `initial` into the cache before restore
        // finishes, or the saved value loses to a newer timestamp. `data ?? initial`
        // still shows `initial` until the saved value arrives.
        ...(persist
            ? {
                enabled: !isRestoring,
                meta: { persist: true as const, cacheFor: options.cacheFor },
            }
            : {
                initialData: initial,
            }),
    });

    const setData = useCallback((value: T | ((prev: T) => T)) =>
        queryClient.setQueryData<T>(queryKey, (prev) =>
            typeof value === 'function'
                ? (value as (prev: T) => T)(prev ?? initial)
                : value,
        ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [queryClient, JSON.stringify(queryKey)],
    );

    // fallback to initial data if not in cache
    const safeData = data ?? initial;

    return [safeData, setData] as const;
}
