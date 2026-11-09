# React hooks we all wished already existed

Small client hooks for shared state and the URL. ESM only. React 18+ and TanStack Query 5 are peer dependencies.

```bash
npm install react-hook-extensions @tanstack/react-query
```

## Hooks

| Hook | |
| --- | --- |
| [`useCache`](src/useCache/README.md) | `useState` that stays in sync for a key, including across visits when you persist it. |
| [`useHashParams`](src/useHashParams/README.md) | Read and clear the URL hash. |
| [`useAllSearchParams`](src/useAllSearchParams/README.md) | Read the current query string. |

## Setup

Wrap the tree once. `useCache` requires this provider. The URL hooks do not.

```tsx
import { HookExtensionsProvider } from "react-hook-extensions";

export function App({ children }: { children: React.ReactNode }) {
    return <HookExtensionsProvider persist>{children}</HookExtensionsProvider>;
}
```

`persist` turns on storage for entries that opt in. It uses `localStorage` under the key `react-hook-extensions`. Pass a storage of your own when you want something else:

```tsx
<HookExtensionsProvider persist={{ storage: sessionStorage, key: "my-app" }}>
    {children}
</HookExtensionsProvider>
```

If the app already has a `QueryClient`, pass it in. The provider can sit inside your existing `QueryClientProvider`.

```tsx
<HookExtensionsProvider client={queryClient} persist>
    {children}
</HookExtensionsProvider>
```

## useCache

```tsx
import { useCache } from "react-hook-extensions";

function Draft() {
    const [draft, setDraft] = useCache("", {
        key: "draft",
        persist: true,
        cacheFor: 1000 * 60 * 60 * 24,
    });

    return <textarea value={draft} onChange={(event) => setDraft(event.target.value)} />;
}
```

Any other `useCache("", { key: "draft" })` reads and writes that same value. Without `persist`, the value lasts for the session (or for `cacheFor` milliseconds after the last reader unmounts).

The first render uses `initial`. A persisted value replaces it after mount, which keeps server HTML and hydration on the same first paint.

## useHashParams

```tsx
import { useHashParams } from "react-hook-extensions";

function Panel() {
    const { parsed, clear } = useHashParams();
    return <button onClick={clear}>{parsed.tab ?? "home"}</button>;
}
```

## useAllSearchParams

```tsx
import { useAllSearchParams } from "react-hook-extensions";

function Search() {
    const { q } = useAllSearchParams<{ q?: string }>();
    return <p>{q ?? "Search"}</p>;
}
```

## Typed cache keys

Augment `CacheRegistry` to allow only known keys and value types:

```ts
declare module "react-hook-extensions" {
    interface CacheRegistry {
        theme: "light" | "dark";
        draft: string;
    }
}
```

Details and the rest of the options are in each hook's README.
