
declare module "react-hook-extensions/config" {
    /**
     * This is the configuration object for react-hook-extensions.
     * It should be found in your project root and named `hookextensions.config.ts`.
     */
    export type Config = {
        cacheOpts: {
            /**
             * This is used to type the CacheKeys.
             * @example
             * In your config file.
             * ```ts
             * export const config: Config = {
             *     cacheOpts: {
             *         keys: [
             *             "user:settings",
             *             "user:me",
             *             // etc...
             *         ],
             *     },
             * };
             * ```
             * 
             * In your code.
             * ``` tsx
             * const [draft, setDraft] = useCache<User | null>(null, {
             *     key: "settings", // <--- this will show a type error because "settings" is not in the keys list
             *     persist: true,
             *     cacheFor: 1000 * 60 * 60 * 24,
             * });
             * ```
             */
            keys: readonly string[];
            /** 
             * This doesn't actualy matter as long as:
             * 1) You dont change it after the first time you use it.
             * 2) You dont use the same key in multiple places.
             * @default "react-hook-extensions" 
            */
            localStorageKey: "react-hook-extensions" | (string & {});
            /**
             * If you want to persist all caches to localStorage, set this to true.
             * We recommend you to keep this `false` and use `useCache` with `persist: true` instead for better control.
             * @default false
             */
            persist: boolean;
        };
    };
}