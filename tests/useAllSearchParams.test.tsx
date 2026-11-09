import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useAllSearchParams } from "../src";

afterEach(() => {
    window.history.replaceState(null, "", "/");
});

function SearchView() {
    const params = useAllSearchParams<{ q?: string; page?: string }>();
    return (
        <>
            <span data-testid="q">{params.q ?? ""}</span>
            <span data-testid="page">{params.page ?? ""}</span>
        </>
    );
}

describe("useAllSearchParams", () => {
    it("reads the query string on the first client render", () => {
        window.history.pushState(null, "", "/?q=hooks&page=2");
        render(<SearchView />);
        expect(screen.getByTestId("q").textContent).toBe("hooks");
        expect(screen.getByTestId("page").textContent).toBe("2");
    });

    it("follows pushState and replaceState", () => {
        render(<SearchView />);
        expect(screen.getByTestId("q").textContent).toBe("");
        act(() => {
            window.history.pushState(null, "", "/?q=hooks");
        });
        expect(screen.getByTestId("q").textContent).toBe("hooks");
        act(() => {
            window.history.replaceState(null, "", "/?q=hooks&page=3");
        });
        expect(screen.getByTestId("page").textContent).toBe("3");
        act(() => {
            window.history.replaceState(null, "", "/");
        });
        expect(screen.getByTestId("q").textContent).toBe("");
    });
});
