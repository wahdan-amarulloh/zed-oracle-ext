#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractNodeRefs,
  findUnknownNodes,
  validateBrackets,
  validateTomlSyntax,
} from "./lib/query-validation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POSIX = process.platform !== "win32";

const USAGE = `Usage: node scripts/validate-queries.mjs [options]

Options:
  --query <file>     Query file to validate (repeatable; default languages/plsql/highlights.scm)
  --config <file>    Language config.toml to validate (default languages/plsql/config.toml)
  --corpus <dir>     PL/SQL corpus directory to parse (default corpus/plsql)
  --grammar <dir>    Pinned grammar directory (default grammars/plsql)
  --no-parse         Skip parsing the corpus (query and config checks still run)
  -h, --help         Show this help

Exits 0 when every check passes, 1 when the repo has problems, and 2 when a
required tool or input is missing.
`;

function parseArgs(argv) {
  const options = {
    queries: [],
    config: path.join(root, "languages", "plsql", "config.toml"),
    corpus: path.join(root, "corpus", "plsql"),
    grammar: path.join(root, "grammars", "plsql"),
    parseCorpus: true,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`missing value for ${arg}`);
      return argv[i];
    };
    switch (arg) {
      case "--query":
        options.queries.push(path.resolve(root, next()));
        break;
      case "--config":
        options.config = path.resolve(root, next());
        break;
      case "--corpus":
        options.corpus = path.resolve(root, next());
        break;
      case "--grammar":
        options.grammar = path.resolve(root, next());
        break;
      case "--no-parse":
        options.parseCorpus = false;
        break;
      case "-h":
      case "--help":
        process.stdout.write(USAGE);
        process.exit(0);
        break;
      default:
        throw new Error(`unknown option: ${arg}`);
    }
  }
  if (options.queries.length === 0) {
    options.queries.push(path.join(root, "languages", "plsql", "highlights.scm"));
  }
  return options;
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

function quoteForCmd(arg) {
  if (arg === "") return '""';
  if (!/[\s"&|<>^%!();]/.test(arg)) return arg;
  return `"${arg.replace(/"/g, '""')}"`;
}

function run(cmd, args) {
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

function resolveTreeSitter() {
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

function parserLibraryName() {
  if (process.platform === "win32") return "plsql.dll";
  if (process.platform === "darwin") return "plsql.dylib";
  return "plsql.so";
}

function loadKnownNodes(grammarDir) {
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

function pinnedCommit() {
  const manifest = path.join(root, "extension.toml");
  if (!existsSync(manifest)) return null;
  const match = readFileSync(manifest, "utf8").match(/\[grammars\.plsql\][^[]*?commit\s*=\s*"([^"]+)"/s);
  return match ? match[1] : null;
}

function checkGrammarRevision(grammarDir, problems) {
  const expected = pinnedCommit();
  if (!expected) return;
  const head = run("git", ["-C", grammarDir, "rev-parse", "HEAD"]);
  if (head.status !== 0) return;
  const actual = head.stdout.trim();
  if (actual && actual !== expected) {
    problems.push({
      message:
        `grammars/plsql is at ${actual.slice(0, 12)}, but extension.toml pins ` +
        `${expected.slice(0, 12)}; node checks would run against the wrong grammar`,
    });
  }
}

function ensureParserLibrary(grammarDir) {
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

const DEFAULT_SUFFIXES = ["pls", "pks", "pkb", "prc", "fnc", "trg", "typ"];

function corpusSuffixes(configFile) {
  if (!existsSync(configFile)) return DEFAULT_SUFFIXES;
  const match = readFileSync(configFile, "utf8").match(/^\s*path_suffixes\s*=\s*\[([^\]]*)\]/m);
  if (!match) return DEFAULT_SUFFIXES;
  const suffixes = [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
  return suffixes.length > 0 ? suffixes : DEFAULT_SUFFIXES;
}

function listCorpusFiles(dir, suffixes) {
  if (!existsSync(dir)) return [];
  const allowed = new Set(suffixes.map((suffix) => `.${suffix.toLowerCase()}`));
  return readdirSync(dir)
    .map((entry) => path.join(dir, entry))
    .filter((file) => statSync(file).isFile())
    .filter((file) => allowed.has(path.extname(file).toLowerCase()))
    .sort();
}

function firstParseError(tree) {
  return tree.split(/\r?\n/).find((line) => /\b(ERROR|MISSING)\b/.test(line)) ?? null;
}

function parseCorpus(lib, corpusDir, suffixes, problems) {
  const files = listCorpusFiles(corpusDir, suffixes);
  const displayDir = path.relative(root, corpusDir);
  if (files.length === 0) {
    problems.push({ message: `${displayDir}: no PL/SQL files found in corpus` });
    return 0;
  }
  for (const file of files) {
    const display = path.relative(root, file);
    const result = run("tree-sitter", ["parse", "-l", lib, "--lang-name", "plsql", file]);
    if (result.status === null) {
      problems.push({ message: `${display}: could not run tree-sitter: ${result.stderr.trim()}` });
      continue;
    }
    const parseError = firstParseError(result.stdout);
    if (parseError) {
      problems.push({ message: `${display}: parse tree has an error node: ${parseError.trim()}` });
      continue;
    }
    if (result.status !== 0) {
      problems.push({
        message: `${display}: parse failed: ${(result.stderr || result.stdout).trim().split(/\r?\n/).pop()}`,
      });
    }
  }
  return files.length;
}

function validateQueryFile(file, knownNodes, lib, problems) {
  const display = path.relative(root, file);
  if (!existsSync(file)) {
    problems.push({ message: `${display}: query file not found` });
    return 0;
  }
  const source = readFileSync(file, "utf8");
  let refs;
  try {
    refs = extractNodeRefs(source);
  } catch (error) {
    problems.push({ message: `${display}: malformed query: ${error.message}` });
    return 0;
  }
  problems.push(...findUnknownNodes(display, refs, knownNodes));

  const compiled = run("tree-sitter", ["query", "-q", "-l", lib, "--lang-name", "plsql", file]);
  if (compiled.status !== 0) {
    const detail = (compiled.stdout + compiled.stderr).trim().split(/\r?\n/).filter(Boolean).pop();
    problems.push({ message: `${display}: query does not compile: ${detail ?? "unknown error"}` });
  }
  return refs.length;
}

function validateConfigFile(file, problems) {
  const display = path.relative(root, file);
  if (!existsSync(file)) {
    problems.push({ message: `${display}: config file not found` });
    return;
  }
  const source = readFileSync(file, "utf8");
  problems.push(...validateTomlSyntax(source, display));
  problems.push(...validateBrackets(source, display));
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    fail(`${error.message}\n\n${USAGE}`);
  }

  const version = resolveTreeSitter();
  process.stdout.write(`${version}\n`);

  const knownNodes = loadKnownNodes(options.grammar);
  const lib = ensureParserLibrary(options.grammar);
  process.stdout.write(`grammar node types: ${knownNodes.size}\n`);

  const problems = [];
  checkGrammarRevision(options.grammar, problems);

  const parsed = options.parseCorpus
    ? parseCorpus(lib, options.corpus, corpusSuffixes(options.config), problems)
    : 0;

  let refs = 0;
  for (const query of options.queries) {
    refs += validateQueryFile(query, knownNodes, lib, problems);
  }

  validateConfigFile(options.config, problems);

  const queryList = options.queries.map((file) => path.relative(root, file)).join(", ");
  process.stdout.write(`parsed corpus files: ${parsed}\n`);
  process.stdout.write(`checked node references: ${refs} in ${queryList}\n`);

  if (problems.length > 0) {
    process.stderr.write(`\n${problems.length} problem(s):\n`);
    for (const problem of problems) process.stderr.write(`  - ${problem.message}\n`);
    process.exit(1);
  }

  process.stdout.write("all checks passed\n");
}

main();
