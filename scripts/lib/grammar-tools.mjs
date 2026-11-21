import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const POSIX = process.platform !== "win32";

export function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

function quoteForCmd(arg) {
  if (arg === "") return '""';
  if (!/[\s"&|<>^%!();]/.test(arg)) return arg;
  return `"${arg.replace(/"/g, '""')}"`;
}

export function run(cmd, args) {
  if (POSIX) {
    const result = spawnSync(cmd, args, { encoding: "utf8" });
    if (result.error) return { status: null, stdout: "", stderr: result.error.message };
    return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
  }
  const line = `${quoteForCmd(cmd)} ${args.map(quoteForCmd).join(" ")}`;
  const result = spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `"${line}"`], {
    encoding: "utf8",
    windowsVerbatimArguments: true,
  });
  if (result.error) return { status: null, stdout: "", stderr: result.error.message };
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

export function resolveTreeSitter() {
  const probe = run("tree-sitter", ["--version"]);
  if (probe.status !== 0) {
    fail(
      "Cannot run `tree-sitter --version`. This validator needs the tree-sitter CLI " +
        "on PATH (0.25 or newer; the grammar's own pinned 0.20.7 is too old).",
    );
  }
  const capability = run("tree-sitter", ["query", "--help"]);
  if (capability.status !== 0 || !capability.stdout.includes("--lang-name")) {
    fail(
      "The tree-sitter CLI on PATH is too old: `tree-sitter query` does not support " +
        "`--lang-name`, so a prebuilt parser cannot be used. Install tree-sitter 0.25 or newer.",
    );
  }
  return probe.stdout.trim();
}

export function parserLibraryName() {
  if (process.platform === "win32") return "plsql.dll";
  if (process.platform === "darwin") return "plsql.dylib";
  return "plsql.so";
}

export function loadKnownNodes(grammarDir, root) {
  const nodeTypesPath = path.join(grammarDir, "src", "node-types.json");
  if (!existsSync(nodeTypesPath)) {
    fail(
      `Missing ${path.relative(root, nodeTypesPath)}. The pinned grammar is cloned by Zed ` +
        "and is not committed, so `grammars/plsql` must exist first (see README).",
    );
  }
  let nodeTypes;
  try {
    nodeTypes = JSON.parse(readFileSync(nodeTypesPath, "utf8"));
  } catch (error) {
    fail(`Cannot parse ${path.relative(root, nodeTypesPath)}: ${error.message}`);
  }
  if (!Array.isArray(nodeTypes)) {
    fail(`${path.relative(root, nodeTypesPath)} is not a node type list.`);
  }
  return new Set(nodeTypes.map((entry) => entry.type));
}

export function ensureParserLibrary(grammarDir, root) {
  const lib = path.join(grammarDir, parserLibraryName());
  const sourceFiles = ["parser.c", "scanner.c"].map((name) => path.join(grammarDir, "src", name));
  const newestSource = Math.max(
    ...sourceFiles.filter((file) => existsSync(file)).map((file) => statSync(file).mtimeMs),
    0,
  );
  const fresh = existsSync(lib) && statSync(lib).mtimeMs >= newestSource;
  if (fresh) return lib;

  process.stdout.write(`building parser library from ${path.relative(root, grammarDir)} ...\n`);
  const result = run("tree-sitter", ["build", grammarDir, "-o", lib]);
  if (result.status !== 0 || !existsSync(lib)) {
    fail(
      `Failed to build the parser library; a C compiler is required.\n` +
        `\`tree-sitter build ${path.relative(root, grammarDir)}\` said:\n` +
        `${(result.stdout + result.stderr).trim()}`,
    );
  }
  return lib;
}
