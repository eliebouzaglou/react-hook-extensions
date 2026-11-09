"use client";

/**
 * Augment this in hookextensions.config.ts to close the set of cache keys.
 *
 * @example
 * declare module "react-hook-extensions" {
 *   interface Register {
 *     cacheKeys: "theme" | "draft";
 *   }
 * }
 */
export interface Register {
    // cacheKeys?: "theme" | "draft"
}

/** A registered cache key, or any string when nothing is registered yet. */
export type CacheKey = Register extends { cacheKeys: infer K }
    ? [K] extends [never]
        ? string
        : K extends string
          ? K
          : string
    : string;

export { useCache } from "./useCache";
export type { CacheSetter, UseCacheOptions, UseCacheResult } from "./useCache";
export { DEFAULT_STORAGE_KEY } from "./persist";
export { HookExtensionsProvider } from "./provider";
export type { HookExtensionsProviderProps, PersistOptions } from "./provider";
export { useHashParams } from "./useHashParams";
export type { UseHashParamsResult } from "./useHashParams";
export { useAllSearchParams } from "./useAllSearchParams";
