import { createContext } from "react";

/** True when the nearest provider was asked to persist `useCache` values. */
export const PersistenceEnabledContext = createContext(false);
