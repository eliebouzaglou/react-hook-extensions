const listeners = new Set<() => void>();
let historyPatched = false;

function emitUrlChange(): void {
    for (const listener of [...listeners]) listener();
}

function ensureHistoryPatched(): void {
    if (historyPatched || typeof window === "undefined") return;
    historyPatched = true;
    const { history } = window;
    if (typeof history.pushState !== "function" || typeof history.replaceState !== "function") return;

    const pushState = history.pushState.bind(history);
    const replaceState = history.replaceState.bind(history);
    history.pushState = (data, unused, url) => {
        pushState(data, unused, url);
        emitUrlChange();
    };
    history.replaceState = (data, unused, url) => {
        replaceState(data, unused, url);
        emitUrlChange();
    };
    window.addEventListener("popstate", emitUrlChange);
    window.addEventListener("hashchange", emitUrlChange);
}

export function subscribeUrl(listener: () => void): () => void {
    ensureHistoryPatched();
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function getSearchSnapshot(): string {
    return window.location.search;
}

export function getHashSnapshot(): string {
    return window.location.hash;
}

export function getEmptySnapshot(): string {
    return "";
}

/** Parse a search string or hash into a flat record. Repeated keys keep the last value. */
export function parseParams(value: string): Record<string, string> {
    const cleaned = value.startsWith("#/")
        ? value.slice(2)
        : value.startsWith("#") || value.startsWith("?")
          ? value.slice(1)
          : value;
    if (cleaned.length === 0) return {};

    const params = new URLSearchParams(cleaned);
    const record: Record<string, string> = {};
    params.forEach((paramValue, key) => {
        record[key] = paramValue;
    });
    return record;
}
