# useAllSearchParams

Read every key in the current query string.

```tsx
const params = useAllSearchParams();
params.q; // "hooks" when the URL is /search?q=hooks
```

Pass a type argument when you want a named shape. It is an assertion, not a runtime check. Values are strings, and repeated keys keep the last one.

```tsx
const { tab } = useAllSearchParams<{ tab?: string }>();
```

The hook follows `pushState`, `replaceState`, and back/forward navigation. The server render and the hydration render are `{}`, then the client snapshot takes over.
