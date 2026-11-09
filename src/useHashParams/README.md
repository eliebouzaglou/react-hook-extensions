# useHashParams

Read the URL hash and clear it without a scroll jump or a reload.

```tsx
const { current, parsed, clear } = useHashParams();

current; // "#tab=docs&panel=api"
parsed.tab; // "docs"
clear();
```

`#/tab=docs` is parsed the same way as `#tab=docs`. The value updates when the hash changes through `hashchange`, back/forward, `pushState`, or `replaceState`.

`T` is an assertion about the shape you expect. Values are strings, and repeated keys keep the last one.

```tsx
const { parsed } = useHashParams<{ tab?: string }>();
```

The server render, and the hydration render, report an empty hash. A client-only render reads the hash immediately.
