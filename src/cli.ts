#!/usr/bin/env node
/// <reference types="node" />
import { realpathSync } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
    ConfigError,
    DEFAULT_CACHE_STORAGE_KEY,
    HELP,
    type HookExtensionsConfig,
    defaultConfigPath,
    parseCliArgs,
    renderConfigModule,
    validateConfigPath,
    validateKeyName,
    validateStorageKey,
} from "./onboard.js";

export type PromptIO = {
    readonly isTTY: boolean;
    question(prompt: string): Promise<string>;
    log(message: string): void;
    error(message: string): void;
    close(): void;
};

export function nodeIO(
    input: typeof process.stdin = process.stdin,
    output: typeof process.stdout = process.stdout,
    errorOutput: typeof process.stderr = process.stderr,
): PromptIO {
    const prompts = createInterface({ input, output });
    return {
        isTTY: Boolean(input.isTTY),
        question: (prompt) => prompts.question(prompt),
        log: (message) => {
            output.write(`${message}\n`);
        },
        error: (message) => {
            errorOutput.write(`${message}\n`);
        },
        close: () => {
            prompts.close();
        },
    };
}

async function askValid(io: PromptIO, prompt: string, parse: (raw: string) => string): Promise<string> {
    for (;;) {
        try {
            return parse(await io.question(prompt));
        } catch (error) {
            if (!(error instanceof ConfigError)) throw error;
            io.error(error.message);
        }
    }
}

async function askYes(io: PromptIO, prompt: string, defaultYes: boolean): Promise<boolean> {
    for (;;) {
        const answer = (await io.question(prompt)).trim().toLowerCase();
        if (!answer) return defaultYes;
        if (answer === "y" || answer === "yes") return true;
        if (answer === "n" || answer === "no") return false;
        io.error("Answer y or n.");
    }
}

async function askKeys(io: PromptIO): Promise<string[]> {
    const keys: string[] = [];
    for (;;) {
        const raw = (await io.question("Cache key name (blank to finish): ")).trim();
        if (!raw) return keys;
        try {
            const name = validateKeyName(raw);
            if (keys.includes(name)) throw new ConfigError(`"${name}" is already a key.`);
            keys.push(name);
        } catch (error) {
            if (!(error instanceof ConfigError)) throw error;
            io.error(error.message);
        }
    }
}

async function fileKind(file: string): Promise<"file" | "other" | "missing"> {
    try {
        return (await stat(file)).isFile() ? "file" : "other";
    } catch (error) {
        if (isNotFound(error)) return "missing";
        throw error;
    }
}

function isNotFound(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function displayPath(cwd: string, file: string): string {
    const relative = path.relative(cwd, file);
    const shown = relative && !relative.startsWith("..") ? relative : file;
    return shown.split(path.sep).join("/");
}

async function run(argv: readonly string[], io: PromptIO, cwd: string): Promise<number> {
    const args = parseCliArgs(argv);
    if (args.help) {
        io.log(HELP);
        return 0;
    }
    const interactive = io.isTTY && args.keys.length === 0;
    if (!interactive && args.keys.length === 0) {
        io.log(HELP);
        return 1;
    }

    const suggestedPath = args.config ?? defaultConfigPath();
    const configPath = interactive
        ? await askValid(io, `Config file [${suggestedPath}]: `, (raw) => validateConfigPath(raw.trim() || suggestedPath))
        : suggestedPath;
    const absolute = path.resolve(cwd, configPath);
    const kind = await fileKind(absolute);
    if (kind === "other") throw new ConfigError(`${displayPath(cwd, absolute)} is not a file.`);
    if (kind === "file" && !args.force) {
        if (!interactive) {
            throw new ConfigError(`${displayPath(cwd, absolute)} already exists. Pass --force to overwrite it.`);
        }
        const overwrite = await askYes(io, `${displayPath(cwd, absolute)} already exists. Overwrite? [y/N] `, false);
        if (!overwrite) {
            io.log("Left the existing config in place.");
            return 0;
        }
    }

    const suggestedStorage = args.storageKey ?? DEFAULT_CACHE_STORAGE_KEY;
    const localStorageKey = interactive
        ? await askValid(io, `localStorage key [${suggestedStorage}]: `, (raw) => validateStorageKey(raw.trim() || suggestedStorage))
        : suggestedStorage;
    const persist = interactive
        ? await askYes(io, "Enable provider persistence? [y/N] ", false)
        : args.persist;
    const config: HookExtensionsConfig = {
        keys: interactive ? await askKeys(io) : args.keys,
        localStorageKey,
        persist,
    };
    const source = renderConfigModule(config);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, source, "utf8");
    const shown = displayPath(cwd, absolute);
    io.log(`Wrote ${shown}`);
    io.log("Include that file in your TypeScript project so UseCacheOptions.key picks up the keys.");
    return 0;
}

export async function main(argv: readonly string[], io: PromptIO, cwd = process.cwd()): Promise<number> {
    try {
        return await run(argv, io, cwd);
    } catch (error) {
        if (error instanceof ConfigError) {
            io.error(error.message);
            return 1;
        }
        throw error;
    } finally {
        io.close();
    }
}

function invokedDirectly(): boolean {
    const entry = process.argv[1];
    if (!entry) return false;
    try {
        return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
    } catch {
        return import.meta.url === pathToFileURL(entry).href;
    }
}

if (invokedDirectly()) {
    const io = nodeIO();
    void main(process.argv.slice(2), io).then(
        (code) => {
            process.exitCode = code;
        },
        (error: unknown) => {
            process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
            process.exitCode = 1;
        },
    );
}
