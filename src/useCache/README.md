# useCache

`useState` that stays in sync anywhere you use the same `key`, including after a navigation that keeps the provider mounted.

## Simple Usage

```tsx
const [draft, setDraft] = useCache<User | null>(null, {
    key: "draft",
});
```

## With LocalStorage

```tsx
const [draft, setDraft] = useCache<User | null>(null, {
    key: "draft",
    persist: true,
    cacheFor: 1000 * 60 * 60 * 24,
});
```

The hook has to render under [`HookExtensionsProvider`](../../README.md). `persist: true` also requires `persist` on that provider, and `cacheFor` has to be a finite number of milliseconds. Saved values must be JSON-serializable. `undefined` is not stored.

`initial` is used only when the key is empty. Later changes to `initial` do not reset a value that is already cached. The first server render, and the first browser render, show `initial` so server HTML matches hydration. The saved value replaces it after mount.

`cacheFor` is how long the value survives after the last component using it unmounts. With `persist`, it is also how long a saved value can be restored, measured from the last write.

## Typed keys

`npx react-hook-extensions init` writes `hookextensions.config.ts`. That file lists your keys and registers them so `UseCacheOptions.key` only accepts those names:

```tsx
useCache("light", { key: "theme" });
```

The value type still comes from `initial`. Without the config, any string key is allowed.
