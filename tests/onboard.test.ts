import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execPath } from "node:process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { main, type PromptIO } from "../src/cli";
import { DEFAULT_STORAGE_KEY } from "../src/persist";
import { DEFAULT_CACHE_STORAGE_KEY, renderConfigModule } from "../src/onboard";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scratch: string[] = [];

afterEach(async () => {
    await Promise.all(scratch.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function scripted(answers: string[], isTTY = true): PromptIO & { logs: string[]; errors: string[] } {
    const queue = [...answers];
    const logs: string[] = [];
    const errors: string[] = [];
    return {
        isTTY,
        logs,
        errors,
        question() {
            const next = queue.shift();
            if (next === undefined) throw new Error("unexpected question");
            return Promise.resolve(next);
        },
        log(message) {
            logs.push(message);
        },
        error(message) {
            errors.push(message);
        },
        close() {},
    };
}

async function tempDir(): Promise<string> {
    const dir = await mkdtemp(path.join(tmpdir(), "hookext-"));
    scratch.push(dir);
    return dir;
}

describe("renderConfigModule", () => {
    it("writes a default export and registers keys from the array", () => {
        expect(
            renderConfigModule({
                keys: ["theme", "draft"],
                localStorageKey: "my-app",
                persist: true,
            }),
        ).toBe(`// Cache keys for react-hook-extensions.
// Add a name to keys. That closes UseCacheOptions.key to this list.

const config = {
    cacheOpts: {
        keys: [
            "theme",
            "draft",
        ] as const,
        localStorageKey: "my-app",
        persist: true,
    },
} as const;

export default config;

declare module "react-hook-extensions" {
    interface Register {
        cacheKeys: (typeof config.cacheOpts.keys)[number];
    }
}
`);
    });

    it("leaves the key union open when there are no keys", () => {
        const source = renderConfigModule({
            keys: [],
            localStorageKey: "react-hook-extensions",
            persist: false,
        });
        expect(source).not.toContain("declare module");
        expect(source).toContain("keys: [] as const");
        expect(source).toContain("persist: false");
    });
});

describe("init", () => {
    it("uses the same default storage key as the provider", () => {
        expect(DEFAULT_CACHE_STORAGE_KEY).toBe(DEFAULT_STORAGE_KEY);
    });

    it("writes the config from flags without prompting", async () => {
        const cwd = await tempDir();
        const io = scripted([], false);
        const code = await main(
            ["init", "--storage-key", "my-app", "--key", "theme", "--key", "draft", "--persist"],
            io,
            cwd,
        );
        expect(code).toBe(0);
        const source = await readFile(path.join(cwd, "hookextensions.config.ts"), "utf8");
        expect(source).toContain('"theme"');
        expect(source).toContain('"draft"');
        expect(source).toContain('localStorageKey: "my-app"');
        expect(source).toContain("persist: true");
        expect(source).toContain("export default config;");
        expect(source).not.toContain("cacheKeys =");
        expect(io.logs[0]).toBe("Wrote hookextensions.config.ts");
    });

    it("refuses to overwrite an existing file unless --force is set", async () => {
        const cwd = await tempDir();
        const file = path.join(cwd, "hookextensions.config.ts");
        await writeFile(file, "keep\n");
        const blocked = scripted([], false);
        expect(await main(["init", "--key", "theme"], blocked, cwd)).toBe(1);
        expect(blocked.errors[0]).toMatch(/Pass --force/);
        expect(await readFile(file, "utf8")).toBe("keep\n");

        const forced = scripted([], false);
        expect(await main(["init", "--key", "theme", "--force"], forced, cwd)).toBe(0);
        expect(await readFile(file, "utf8")).toContain('"theme"');
    });

    it("asks for keys and writes them into the ts config", async () => {
        const cwd = await tempDir();
        const io = scripted(["", "", "y", "1bad", "theme", "draft", ""]);
        expect(await main(["init"], io, cwd)).toBe(0);
        expect(io.errors.some((message) => message.includes("JavaScript identifier"))).toBe(true);
        const source = await readFile(path.join(cwd, "hookextensions.config.ts"), "utf8");
        expect(source).toContain('"theme"');
        expect(source).toContain('"draft"');
        expect(source).toContain("persist: true");
        expect(source).toContain('cacheKeys: (typeof config.cacheOpts.keys)[number]');
    });

    it("puts the file in src when that folder exists", async () => {
        const cwd = await tempDir();
        await mkdir(path.join(cwd, "src"));
        const io = scripted(["", "", "n", "count", ""]);
        expect(await main([], io, cwd)).toBe(0);
        const source = await readFile(path.join(cwd, "src/hookextensions.config.ts"), "utf8");
        expect(source).toContain('"count"');
        expect(source).toContain("persist: false");
    });

    it("leaves an existing file alone when the prompt is declined", async () => {
        const cwd = await tempDir();
        const file = path.join(cwd, "hookextensions.config.ts");
        await writeFile(file, "keep\n");
        const io = scripted(["", "n"]);
        expect(await main(["init"], io, cwd)).toBe(0);
        expect(io.logs).toContain("Left the existing config in place.");
        expect(await readFile(file, "utf8")).toBe("keep\n");
    });

    it("prints help and exits 1 when there is no terminal and no keys", async () => {
        const cwd = await tempDir();
        const io = scripted([], false);
        expect(await main([], io, cwd)).toBe(1);
        expect(io.logs.join("\n")).toContain("hookextensions.config.ts");
    });

    it("prints help and exits 0 for --help", async () => {
        const io = scripted([], false);
        expect(await main(["--help"], io, await tempDir())).toBe(0);
        expect(io.logs.join("\n")).toContain("--key");
    });
});

describe("wired cache keys", () => {
    it("typechecks useCache with registered key names only", async () => {
        const parent = path.join(repoRoot, "node_modules/.cache");
        await mkdir(parent, { recursive: true });
        const cwd = await mkdtemp(path.join(parent, "hookext-"));
        scratch.push(cwd);
        const io = scripted([], false);
        expect(
            await main(
                ["init", "--storage-key", "my-app", "--key", "theme", "--key", "draft", "--persist"],
                io,
                cwd,
            ),
        ).toBe(0);

        await writeFile(
            path.join(cwd, "usage.ts"),
            `import { useCache } from "react-hook-extensions";
import config from "./hookextensions.config";

export function theme(): string {
    const [value, setValue] = useCache("light", { key: "theme" });
    setValue("dark");
    return value;
}

export function draft(): string {
    const [value] = useCache("untitled", { key: "draft", persist: true, cacheFor: 1000 });
    return value;
}

export function rejected(): void {
    // @ts-expect-error nope is not a cache key
    useCache("x", { key: "nope" });
}

export const storage: string = config.cacheOpts.localStorageKey;
export const persists: true = config.cacheOpts.persist;
`,
        );
        const entry = path.relative(cwd, path.join(repoRoot, "src/index.ts")).split(path.sep).join("/");
        await writeFile(
            path.join(cwd, "tsconfig.json"),
            JSON.stringify(
                {
                    compilerOptions: {
                        target: "ES2022",
                        lib: ["ES2022", "DOM", "DOM.Iterable"],
                        module: "ESNext",
                        moduleResolution: "bundler",
                        jsx: "react-jsx",
                        strict: true,
                        verbatimModuleSyntax: true,
                        esModuleInterop: true,
                        skipLibCheck: true,
                        noEmit: true,
                        types: [],
                        baseUrl: ".",
                        paths: { "react-hook-extensions": [entry] },
                    },
                    files: ["hookextensions.config.ts", "usage.ts"],
                },
                null,
                2,
            ),
        );

        const tsc = path.join(repoRoot, "node_modules/typescript/lib/tsc.js");
        await new Promise<void>((resolve, reject) => {
            execFile(execPath, [tsc, "-p", path.join(cwd, "tsconfig.json")], { cwd }, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`${stdout}\n${stderr}`));
                    return;
                }
                resolve();
            });
        });
    }, 30_000);
});
