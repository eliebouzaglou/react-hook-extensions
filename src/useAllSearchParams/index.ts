"use client";
import { useState, useEffect } from "react";

export function useAllSearchParams<T extends unknown = Record<string, any>>() {
    const [searchParams, setSearchParams] = useState<T>({} as T);


    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const record: Record<string, string> = {};
        params.forEach((value, key) => {
            record[key] = value;
        });
        setSearchParams(record as T);
    }, []);


    return searchParams;
}