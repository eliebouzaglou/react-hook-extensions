"use client";

import { useMemo, useSyncExternalStore } from "react";
import { getEmptySnapshot, getSearchSnapshot, parseParams, subscribeUrl } from "../url";

/**
 * The current URL search params. `T` is an assertion about the shape you expect,
 * not a runtime check. Repeated keys keep the last value.
 *
 * The server render and the first hydration render are `{}`. After hydration the
 * hook follows `pushState`, `replaceState`, and back/forward navigation.
 */
export function useAllSearchParams<T = Record<string, string>>(): T {
    const search = useSyncExternalStore(subscribeUrl, getSearchSnapshot, getEmptySnapshot);
    return useMemo(() => parseParams(search) as T, [search]);
}
