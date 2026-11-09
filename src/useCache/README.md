# useCache

`useState` that stays in sync anywhere you use the same `key`, including after a navigation that keeps the provider mounted.

```tsx
const [draft, setDraft] = useCache("", {
    key: "draft",
    persist: true,
    cacheFor: 1000 * 60 * 60 * 24,
});
```

The hook has to render under [`HookExtensionsProvider`](../../README.md). `persist: true` also requires `persist` on that provider, and `cacheFor` has to be a finite number of milliseconds. Saved values must be JSON-serializable. `undefined` is not stored.

`initial` is used only when the key is empty. Later changes to `initial` do not reset a value that is already cached. The first server render, and the first browser render, show `initial` so server HTML matches hydration. The saved value replaces it after mount.

`cacheFor` is how long the value survives after the last component using it unmounts. With `persist`, it is also how long a saved value can be restored, measured from the last write.

To allow only known keys, augment `CacheRegistry`:

```ts
declare module "react-hook-extensions" {
    interface CacheRegistry {
        theme: "light" | "dark";
        draft: string;
    }
}
```

After that, `key` must be one of those names and the value must match.
