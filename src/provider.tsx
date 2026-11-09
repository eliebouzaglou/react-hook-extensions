"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { IsRestoringProvider, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistenceEnabledContext } from "./context";
import { DEFAULT_STORAGE_KEY, loadPersistedCache, savePersistedCache } from "./persist";

export type PersistOptions = {
    /** Storage used to restore persisted cache entries. Defaults to `localStorage` in the browser. */
    storage?: Storage;
    /** Storage key. @default "react-hook-extensions" */
    key?: string;
};

export type HookExtensionsProviderProps = {
    children: ReactNode;
    /**
     * Query client to share with the rest of the app.
     * When omitted, the provider creates one and owns it.
     */
    client?: QueryClient;
    /**
     * Persist `useCache` values marked `persist: true`.
     * Pass `true` to use `localStorage`, or an options object for a custom storage.
     */
    persist?: boolean | PersistOptions;
};

function createQueryClient(): QueryClient {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                refetchOnWindowFocus: false,
                refetchOnReconnect: false,
                networkMode: "always",
            },
        },
    });
}

function persistenceRequested(persist: HookExtensionsProviderProps["persist"]): boolean {
    return persist === true || (typeof persist === "object" && persist !== null);
}

function resolveStorage(persist: HookExtensionsProviderProps["persist"]): Storage | null {
    if (!persist) return null;
    if (typeof persist === "object" && persist.storage) return persist.storage;
    if (typeof window === "undefined") return null;
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function resolveStorageKey(persist: HookExtensionsProviderProps["persist"]): string {
    if (typeof persist === "object" && persist.key !== undefined && persist.key.length > 0) return persist.key;
    return DEFAULT_STORAGE_KEY;
}

export function HookExtensionsProvider({ children, client, persist = false }: HookExtensionsProviderProps) {
    const requested = persistenceRequested(persist);
    const storage = resolveStorage(persist);
    const storageKey = resolveStorageKey(persist);
    const [ownedClient] = useState(() => client ?? createQueryClient());
    const queryClient = client ?? ownedClient;
    const [isRestoring, setIsRestoring] = useState(requested);
    const lastWritten = useRef<string | null>(null);

    useEffect(() => {
        if (!requested || !storage) {
            setIsRestoring(false);
            return;
        }

        lastWritten.current = null;
        loadPersistedCache(queryClient, storage, storageKey, lastWritten);
        const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
            if (event.type !== "updated") return;
            savePersistedCache(queryClient, storage, storageKey, lastWritten);
        });
        const onStorage = (event: StorageEvent) => {
            if (event.key !== storageKey || event.newValue === null) return;
            if (event.storageArea && event.storageArea !== storage) return;
            if (event.newValue === lastWritten.current) return;
            loadPersistedCache(queryClient, storage, storageKey, lastWritten);
        };
        window.addEventListener("storage", onStorage);
        // Strict Mode runs this effect twice before the re-render from setState,
        // so both restores finish before queries are allowed to write `initial`.
        setIsRestoring(false);

        return () => {
            unsubscribe();
            window.removeEventListener("storage", onStorage);
            savePersistedCache(queryClient, storage, storageKey, lastWritten);
        };
    }, [requested, queryClient, storage, storageKey]);

    if (typeof persist === "object" && persist.key !== undefined && persist.key.length === 0) {
        throw new Error("HookExtensionsProvider: persist.key must be a non-empty string.");
    }

    return (
        <PersistenceEnabledContext.Provider value={requested}>
            <IsRestoringProvider value={isRestoring}>
                <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
            </IsRestoringProvider>
        </PersistenceEnabledContext.Provider>
    );
}
