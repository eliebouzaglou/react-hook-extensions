import { useCache } from "../src";

declare module "../src/index" {
    interface Register {
        cacheKeys: "theme" | "draft";
    }
}

export function registeredTheme(): "light" | "dark" {
    const [theme, setTheme] = useCache<"light" | "dark">("light", { key: "theme" });
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
