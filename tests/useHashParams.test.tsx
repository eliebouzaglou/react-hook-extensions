import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useHashParams } from "../src";

afterEach(() => {
    window.history.replaceState(null, "", "/");
});

function HashView() {
    const { current, parsed, clear } = useHashParams<{ tab?: string; sort?: string }>();
    return (
        <>
            <span data-testid="current">{current}</span>
            <span data-testid="tab">{parsed.tab ?? ""}</span>
            <span data-testid="sort">{parsed.sort ?? ""}</span>
            <button onClick={clear}>clear</button>
        </>
    );
}

describe("useHashParams", () => {
    it("reads the hash on the first client render", () => {
        window.history.pushState(null, "", "/#tab=docs");
        render(<HashView />);
        expect(screen.getByTestId("current").textContent).toBe("#tab=docs");
        expect(screen.getByTestId("tab").textContent).toBe("docs");
    });

    it("parses a #/ prefix and repeated keys", () => {
        window.history.pushState(null, "", "/#/tab=docs&tab=api&sort=asc");
        render(<HashView />);
        expect(screen.getByTestId("tab").textContent).toBe("api");
        expect(screen.getByTestId("sort").textContent).toBe("asc");
    });

    it("follows hash changes and clears the hash without dropping the search", () => {
        window.history.pushState(null, "", "/?q=hooks#tab=docs");
        render(<HashView />);
        act(() => {
            window.history.pushState(null, "", "/?q=hooks#tab=install");
        });
        expect(screen.getByTestId("tab").textContent).toBe("install");
        act(() => {
            window.location.hash = "#tab=api";
            window.dispatchEvent(new HashChangeEvent("hashchange"));
        });
        expect(screen.getByTestId("tab").textContent).toBe("api");
        act(() => screen.getByText("clear").click());
        expect(screen.getByTestId("current").textContent).toBe("");
        expect(window.location.hash).toBe("");
        expect(window.location.search).toBe("?q=hooks");
    });
});
