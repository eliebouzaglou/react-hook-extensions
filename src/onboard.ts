export const CONFIG_FILENAME = "hookextensions.config.ts";

/** Matches `DEFAULT_STORAGE_KEY` in persist.ts. The CLI stays free of React. */
export const DEFAULT_CACHE_STORAGE_KEY = "react-hook-extensions";

export const HELP = `Usage
  react-hook-extensions init
  react-hook-extensions init --key theme --key draft --persist

init writes hookextensions.config.ts. That file lists your cache keys and
registers them so UseCacheOptions.key only accepts those names.

Edit the keys array to add another key. Run init again with --force to replace it.

Options
  --config <path>         File to write. Default: src/hookextensions.config.ts when src/ exists
  --storage-key <name>    localStorage key. Default: react-hook-extensions
  --key <name>            Repeatable cache key name
  --persist               Set cacheOpts.persist to true
  --force                 Overwrite an existing file
  --help`;

export class ConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ConfigError";
    }
}

export type HookExtensionsConfig = {
    keys: readonly string[];
    localStorageKey: string;
    persist: boolean;
};

export type CliArgs = {
    command: "init" | null;
    help: boolean;
    force: boolean;
    persist: boolean;
    config?: string;
    storageKey?: string;
    keys: string[];
};

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export function defaultConfigPath(hasSrc: boolean): string {
    return hasSrc ? `src/${CONFIG_FILENAME}` : CONFIG_FILENAME;
}

export function validateConfigPath(file: string): string {
    const trimmed = file.trim();
    if (!trimmed || /[\r\n\0]/.test(trimmed)) {
        throw new ConfigError("The config path must be a .ts file.");
    }
    if (trimmed.endsWith(".d.ts") || !trimmed.endsWith(".ts")) {
        throw new ConfigError("The config must be a .ts file.");
    }
    return trimmed;
}

export function validateStorageKey(value: string): string {
    const trimmed = value.trim();
    if (!trimmed || /[\r\n]/.test(trimmed)) {
        throw new ConfigError("localStorageKey must be a non-empty single-line string.");
    }
    return trimmed;
}

export function validateKeyName(name: string): string {
    const trimmed = name.trim();
    if (!IDENTIFIER.test(trimmed)) {
        throw new ConfigError(`Cache key "${name}" must be a JavaScript identifier.`);
    }
    return trimmed;
}

export function parseCliArgs(argv: readonly string[]): CliArgs {
    let command: "init" | null = null;
    let help = false;
    let force = false;
    let persist = false;
    let config: string | undefined;
    let storageKey: string | undefined;
    const keys: string[] = [];

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === undefined) continue;
        if (arg === "--help" || arg === "-h") {
            help = true;
            continue;
        }
        if (arg === "--force") {
            force = true;
            continue;
        }
        if (arg === "--persist") {
            persist = true;
            continue;
        }
        if (arg === "init") {
            if (command !== null) throw new ConfigError('The command "init" was passed twice.');
            command = "init";
            continue;
        }
        if (!arg.startsWith("--")) {
            throw new ConfigError(`Unknown command "${arg}". Edit hookextensions.config.ts, or run init.`);
        }
        const eq = arg.indexOf("=");
        const flag = eq === -1 ? arg : arg.slice(0, eq);
        const inline = eq === -1 ? undefined : arg.slice(eq + 1);
        const value = inline !== undefined ? inline : argv[index + 1];
        if (inline === undefined) {
            if (value === undefined || value.startsWith("--")) {
                throw new ConfigError(`${flag} needs a value.`);
            }
            index += 1;
        }
        if (value === undefined) throw new ConfigError(`${flag} needs a value.`);
        if (flag === "--config") {
            if (config !== undefined) throw new ConfigError("--config was passed twice.");
            config = validateConfigPath(value);
        } else if (flag === "--storage-key") {
            if (storageKey !== undefined) throw new ConfigError("--storage-key was passed twice.");
            storageKey = validateStorageKey(value);
        } else if (flag === "--key") {
            const name = validateKeyName(value);
            if (keys.includes(name)) throw new ConfigError(`Duplicate cache key "${name}".`);
            keys.push(name);
        } else {
            throw new ConfigError(`Unknown option "${flag}".`);
        }
    }

    return { command, help, force, persist, config, storageKey, keys };
}

export function renderConfigModule(config: HookExtensionsConfig): string {
    const localStorageKey = validateStorageKey(config.localStorageKey);
    const keys = config.keys.map((name) => validateKeyName(name));
    const lines = [
        "import type { Config } from 'react-hook-extensions/config';",
        "// Cache keys for react-hook-extensions.",
        "// Add a name to keys. That closes UseCacheOptions.key to this list.",
        "",
        "const config: Config = {",
        "    cacheOpts: {",
    ];
    if (keys.length === 0) {
        lines.push("        keys: [");
        lines.push("            // add your keys here");
        lines.push("        ] as const,");
    }
    else {
        lines.push("        keys: [");
        for (const name of keys) {
            lines.push(`            ${JSON.stringify(name)},`);
        }
        lines.push("        ] as const,");
    }
    lines.push(
        `        localStorageKey: ${JSON.stringify(localStorageKey)},`,
        `        persist: ${config.persist},`,
        "    },",
        "} as const;",
        "",
        "export default config;",
        "",
    );
    if (keys.length > 0) {
        lines.push('declare module "react-hook-extensions" {');
        lines.push("    interface Register {");
        lines.push("        cacheKeys: (typeof config.cacheOpts.keys)[number];");
        lines.push("    }");
        lines.push("}");
        lines.push("");
    }
    return lines.join("\n");
}
