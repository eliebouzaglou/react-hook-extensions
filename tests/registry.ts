import { useCache } from "../src";

declare module "../src/cacheRegistry" {
    interface CacheRegistry {
        theme: "light" | "dark";
        draft: string;
    }
}

export function registeredTheme(): "light" | "dark" {
    const [theme, setTheme] = useCache("light", { key: "theme" });
    setTheme("dark");
    setTheme((current) => (current === "light" ? "dark" : "light"));
    const [draft] = useCache("untitled", { key: "draft", persist: true, cacheFor: 1000 });
    draft satisfies string;
    return theme;
}

export function rejectedKey(): void {
    // @ts-expect-error "missing" is not a registered cache key
    useCache("x", { key: "missing" });
}

export function rejectedValue(): void {
    // @ts-expect-error theme does not accept a number
    useCache(1, { key: "theme" });
}
