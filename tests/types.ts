import { useCache } from "../src";

export function inferredCache(): number {
    const [count, setCount] = useCache(0, { key: "count" });
    setCount(count + 1);
    setCount((current) => current + 1);

    const [title] = useCache("untitled", {
        key: "draft",
        persist: true,
        cacheFor: 60_000,
    });
    const text: string = title;
    return count + text.length;
}

export function rejectedPersist(flag: boolean): void {
    if (!flag) return;
    // @ts-expect-error persist requires cacheFor
    useCache(0, { key: "count", persist: true });
}
