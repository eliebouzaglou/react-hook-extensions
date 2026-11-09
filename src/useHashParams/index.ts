"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { getEmptySnapshot, getHashSnapshot, parseParams, subscribeUrl } from "../url";

export interface UseHashParamsResult<T = Record<string, string>> {
    /** The raw hash string, including the leading `#` (for example `#foo=bar&hello=world`). */
    current: string;
    /** Key-value pairs parsed from the hash. Repeated keys keep the last value. */
    parsed: T;
    /** Removes the hash from the URL without scrolling or reloading. */
    clear: () => void;
}

export function useHashParams<T = Record<string, string>>(): UseHashParamsResult<T> {
    const current = useSyncExternalStore(subscribeUrl, getHashSnapshot, getEmptySnapshot);
    const parsed = useMemo(() => parseParams(current) as T, [current]);
    const clear = useCallback(() => {
        if (typeof window === "undefined") return;
        const next = window.location.pathname + window.location.search;
        window.history.replaceState(null, "", next);
    }, []);

    return { current, parsed, clear };
}
