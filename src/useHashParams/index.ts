"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

interface UseHashResult {
    /** The raw hash string including the '#' symbol (e.g., "#foo=bar&hello=world") */
    current: string;
    /** A parsed object of key-value pairs from the hash */
    parsed: Record<string, string>;
    /** Removes the hash from the browser URL completely without jumping or reloading */
    clear: () => void;
}

export function useHashParams(): UseHashResult {
    const [rawHash, setRawHash] = useState<string>("");

    useEffect(() => {
        // Set initial value on client mount
        setRawHash(window.location.hash);

        const handleHashChange = () => {
            setRawHash(window.location.hash);
        };

        window.addEventListener("hashchange", handleHashChange);
        return () => window.removeEventListener("hashchange", handleHashChange);
    }, []);

    // Compute key-value object whenever rawHash changes
    const parsed = useMemo(<T extends unknown = Record<string, any>>() => {
        if (!rawHash || rawHash === "#") return {};

        // Remove the leading character ('#' or '#/')
        const cleanedHash = rawHash.startsWith("#/") ? rawHash.slice(2) : rawHash.slice(1);
        const params = new URLSearchParams(cleanedHash);
        const record: Record<string, string> = {};

        params.forEach((value, key) => {
            record[key] = value;
        });

        return record as T;
    }, [rawHash]);


    // Method to completely clear the hash from the address bar
    const clear = useCallback(() => {
        if (typeof window !== "undefined") {
            const urlWithoutHash = window.location.pathname + window.location.search;
            window.history.replaceState(null, "", urlWithoutHash);
            setRawHash("");
        }
    }, []);

    return {
        current: rawHash,
        parsed,
        clear,
    };
}
