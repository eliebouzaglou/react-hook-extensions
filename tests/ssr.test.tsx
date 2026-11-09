import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HookExtensionsProvider, useAllSearchParams, useCache, useHashParams } from "../src";

describe("server render", () => {
    it("renders initial cache and empty URL state", () => {
        function Page() {
            const [draft] = useCache("empty", { key: "draft" });
            const params = useAllSearchParams<{ q?: string }>();
            const hash = useHashParams();
            return (
                <p>
                    {draft}|{params.q ?? ""}|{hash.current}
                </p>
            );
        }

        const html = renderToString(
            <HookExtensionsProvider>
                <Page />
            </HookExtensionsProvider>,
        );
        expect(html.replace(/<!--.*?-->/g, "")).toContain("empty||");
    });

    it("keeps the first persisted render on initial so hydration can match", () => {
        function Page() {
            const [draft] = useCache("empty", { key: "draft", persist: true, cacheFor: 1000 });
            return <p>{draft}</p>;
        }
        const html = renderToString(
            <HookExtensionsProvider persist>
                <Page />
            </HookExtensionsProvider>,
        );
        expect(html).toContain("empty");
    });
});
