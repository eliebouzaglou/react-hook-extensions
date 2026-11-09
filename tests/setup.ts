import { notifyManager } from "@tanstack/react-query";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { createMemoryStorage } from "./storage";

// Query notifications are scheduled with setTimeout(0). Run them immediately so
// assertions see the update inside `act`.
notifyManager.setScheduler((callback) => {
    callback();
});

const memory = createMemoryStorage();
// Node can expose a missing `localStorage` that shadows jsdom. Install one the tests can clear.
let storage: Storage = memory;
try {
    Object.defineProperty(window, "localStorage", {
        configurable: true,
        writable: true,
        value: memory,
    });
} catch {
    storage = window.localStorage;
}

afterEach(() => {
    cleanup();
    storage.clear();
});
