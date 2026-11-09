import { QueryClient } from "@tanstack/react-query";
import { act, render, renderHook, screen } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { HookExtensionsProvider, useCache } from "../src";
import { createMemoryStorage } from "./storage";

describe("useCache", () => {
    it("requires a provider", () => {
        function Bare() {
            useCache(1, { key: "n" });
            return null;
        }
        expect(() => render(<Bare />)).toThrow(/HookExtensionsProvider/);
    });

    it("shares a key across components and keeps 0 and null", () => {
        function Mirror() {
            const [value] = useCache<number | null>(1, { key: "shared" });
            return <span data-testid="mirror">{String(value)}</span>;
        }
        function Editor() {
            const [value, setValue] = useCache<number | null>(1, { key: "shared" });
            return (
                <>
                    <span data-testid="editor">{String(value)}</span>
                    <button onClick={() => setValue(0)}>zero</button>
                    <button onClick={() => setValue(null)}>clear</button>
                    <button onClick={() => setValue((current) => (current ?? 0) + 1)}>inc</button>
                    <Mirror />
                </>
            );
        }

        render(
            <HookExtensionsProvider>
                <Editor />
            </HookExtensionsProvider>,
        );

        expect(screen.getByTestId("editor").textContent).toBe("1");
        expect(screen.getByTestId("mirror").textContent).toBe("1");
        act(() => screen.getByText("zero").click());
        expect(screen.getByTestId("editor").textContent).toBe("0");
        expect(screen.getByTestId("mirror").textContent).toBe("0");
        act(() => screen.getByText("inc").click());
        expect(screen.getByTestId("editor").textContent).toBe("1");
        act(() => screen.getByText("clear").click());
        expect(screen.getByTestId("editor").textContent).toBe("null");
        expect(screen.getByTestId("mirror").textContent).toBe("null");
    });

    it("keeps different keys apart", () => {
        function Pair() {
            const [left, setLeft] = useCache("a", { key: "left" });
            const [right] = useCache("b", { key: "right" });
            return (
                <>
                    <span data-testid="left">{left}</span>
                    <span data-testid="right">{right}</span>
                    <button onClick={() => setLeft("changed")}>set</button>
                </>
            );
        }
        render(
            <HookExtensionsProvider>
                <Pair />
            </HookExtensionsProvider>,
        );
        act(() => screen.getByText("set").click());
        expect(screen.getByTestId("left").textContent).toBe("changed");
        expect(screen.getByTestId("right").textContent).toBe("b");
    });

    it("drops an unused value after cacheFor", () => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
        try {
            const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
            const wrapper = ({ children }: { children: ReactNode }) => (
                <HookExtensionsProvider client={client}>{children}</HookExtensionsProvider>
            );
            const first = renderHook(() => useCache("initial", { key: "temp", cacheFor: 1000 }), { wrapper });
            act(() => first.result.current[1]("updated"));
            expect(first.result.current[0]).toBe("updated");
            first.unmount();

            const during = renderHook(() => useCache("initial", { key: "temp", cacheFor: 1000 }), { wrapper });
            expect(during.result.current[0]).toBe("updated");
            during.unmount();

            act(() => {
                vi.advanceTimersByTime(1000);
            });

            const after = renderHook(() => useCache("initial", { key: "temp", cacheFor: 1000 }), { wrapper });
            expect(after.result.current[0]).toBe("initial");
        } finally {
            vi.useRealTimers();
        }
    });

    it("throws when persist is missing a finite cacheFor", () => {
        function Bad() {
            useCache(0, { key: "count", persist: true, cacheFor: Number.POSITIVE_INFINITY });
            return null;
        }
        expect(() =>
            render(
                <HookExtensionsProvider persist>
                    <Bad />
                </HookExtensionsProvider>,
            ),
        ).toThrow(/finite/);
    });

    it("throws when cacheFor is negative", () => {
        function Bad() {
            useCache(0, { key: "count", cacheFor: -1 });
            return null;
        }
        expect(() =>
            render(
                <HookExtensionsProvider>
                    <Bad />
                </HookExtensionsProvider>,
            ),
        ).toThrow(/cacheFor/);
    });

    it("warns when persist is set without provider persistence", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        function Draft() {
            const [value] = useCache("local", { key: "draft-warning", persist: true, cacheFor: 1000 });
            return <span>{value}</span>;
        }
        render(
            <HookExtensionsProvider>
                <Draft />
            </HookExtensionsProvider>,
        );
        expect(screen.getByText("local")).toBeTruthy();
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("draft-warning"));
        warn.mockRestore();
    });

    it("persists a value and restores it in a new provider", () => {
        const storage = createMemoryStorage();
        function Draft() {
            const [value, setValue] = useCache("empty", { key: "draft", persist: true, cacheFor: 60_000 });
            return (
                <>
                    <span data-testid="draft">{value}</span>
                    <button onClick={() => setValue("saved")}>save</button>
                </>
            );
        }

        const first = render(
            <HookExtensionsProvider persist={{ storage, key: "app" }}>
                <Draft />
            </HookExtensionsProvider>,
        );
        expect(screen.getByTestId("draft").textContent).toBe("empty");
        act(() => screen.getByText("save").click());
        expect(screen.getByTestId("draft").textContent).toBe("saved");
        expect(storage.getItem("app")).toContain("saved");
        first.unmount();

        render(
            <HookExtensionsProvider persist={{ storage, key: "app" }}>
                <Draft />
            </HookExtensionsProvider>,
        );
        expect(screen.getByTestId("draft").textContent).toBe("saved");
    });

    it("does not restore a value older than cacheFor", () => {
        const storage = createMemoryStorage();
        function Draft() {
            const [value, setValue] = useCache("empty", { key: "draft", persist: true, cacheFor: 1000 });
            return (
                <>
                    <span data-testid="draft">{value}</span>
                    <button onClick={() => setValue("saved")}>save</button>
                </>
            );
        }

        const first = render(
            <HookExtensionsProvider persist={{ storage, key: "app" }}>
                <Draft />
            </HookExtensionsProvider>,
        );
        act(() => screen.getByText("save").click());
        first.unmount();

        const saved = storage.getItem("app");
        expect(saved).toBeTruthy();
        const state = JSON.parse(saved ?? "{}") as { queries: Array<{ state: { dataUpdatedAt: number } }> };
        const query = state.queries[0];
        expect(query).toBeTruthy();
        if (!query) return;
        query.state.dataUpdatedAt = Date.now() - 5_000;
        storage.setItem("app", JSON.stringify(state));

        render(
            <HookExtensionsProvider persist={{ storage, key: "app" }}>
                <Draft />
            </HookExtensionsProvider>,
        );
        expect(screen.getByTestId("draft").textContent).toBe("empty");
        expect(storage.getItem("app")).toBeNull();
    });

    it("does not write entries that opted out of persist", () => {
        const storage = createMemoryStorage();
        function Session() {
            const [value, setValue] = useCache("nope", { key: "session" });
            return (
                <>
                    <span>{value}</span>
                    <button onClick={() => setValue("changed")}>set</button>
                </>
            );
        }
        render(
            <HookExtensionsProvider persist={{ storage, key: "app" }}>
                <Session />
            </HookExtensionsProvider>,
        );
        act(() => screen.getByText("set").click());
        expect(storage.getItem("app")).toBeNull();
    });

    it("keeps an in-memory value when the persisted value cannot be serialized", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const storage = createMemoryStorage();
        function Box() {
            const [value, setValue] = useCache<string | bigint>("ok", {
                key: "box",
                persist: true,
                cacheFor: 1000,
            });
            return (
                <>
                    <span data-testid="value">{typeof value === "bigint" ? "bigint" : value}</span>
                    <button onClick={() => setValue(1n)}>save</button>
                </>
            );
        }
        render(
            <HookExtensionsProvider persist={{ storage, key: "app" }}>
                <Box />
            </HookExtensionsProvider>,
        );
        act(() => screen.getByText("save").click());
        expect(screen.getByTestId("value").textContent).toBe("bigint");
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("JSON-serializable"));
        warn.mockRestore();
    });

    it("restores under StrictMode", () => {
        const storage = createMemoryStorage();
        function Draft() {
            const [value, setValue] = useCache("empty", { key: "draft", persist: true, cacheFor: 60_000 });
            return (
                <>
                    <span data-testid="draft">{value}</span>
                    <button onClick={() => setValue("saved")}>save</button>
                </>
            );
        }
        const first = render(
            <StrictMode>
                <HookExtensionsProvider persist={{ storage, key: "strict" }}>
                    <Draft />
                </HookExtensionsProvider>
            </StrictMode>,
        );
        act(() => screen.getByText("save").click());
        first.unmount();
        render(
            <StrictMode>
                <HookExtensionsProvider persist={{ storage, key: "strict" }}>
                    <Draft />
                </HookExtensionsProvider>
            </StrictMode>,
        );
        expect(screen.getByTestId("draft").textContent).toBe("saved");
    });

    it("uses localStorage when persist is true", () => {
        function Draft() {
            const [value, setValue] = useCache("empty", { key: "draft", persist: true, cacheFor: 60_000 });
            return <button onClick={() => setValue(value === "empty" ? "saved" : value)}>save</button>;
        }
        render(
            <HookExtensionsProvider persist>
                <Draft />
            </HookExtensionsProvider>,
        );
        act(() => screen.getByText("save").click());
        expect(window.localStorage.getItem("react-hook-extensions")).toContain("saved");
    });
});
