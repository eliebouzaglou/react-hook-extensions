/**
 * Map of `useCache` keys to the value stored at each key.
 * With no augmentation, keys are any string and the value is inferred from `initial`.
 *
 * @example
 * declare module "react-hook-extensions" {
 *   interface CacheRegistry {
 *     theme: "light" | "dark";
 *   }
 * }
 */
export interface CacheRegistry {
    // Augment this interface to close the set of cache keys.
}

export type CacheKey = keyof CacheRegistry extends never ? string : keyof CacheRegistry & string;
