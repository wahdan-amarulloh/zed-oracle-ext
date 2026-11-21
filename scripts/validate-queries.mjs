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

const USAGE = `Usage: node scripts/validate-queries.mjs [options]

Options:
  --query <file>     Query file to validate (repeatable; default languages/plsql/highlights.scm)
  --config <file>    Language config.toml to validate (default languages/plsql/config.toml)
  --corpus <dir>     PL/SQL corpus directory to parse (default corpus/plsql)
  --grammar <dir>    Pinned grammar directory (default grammars/plsql)
  --no-parse         Skip parsing the corpus
  -h, --help         Show this help

Exits 0 when every check passes, 1 otherwise.
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

function quoteArg(arg) {
  if (!/[\s"&|<>^]/.test(arg)) return arg;
  return `"${arg.replace(/"/g, '""')}"`;
}

function capture(cmd, args, options = {}) {
  const isWindows = process.platform === "win32";
  const result = isWindows
    ? spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", [cmd, ...args].map(quoteArg).join(" ")], {
        encoding: "utf8",
        windowsVerbatimArguments: true,
        ...options,
      })
    : spawnSync(cmd, args, { encoding: "utf8", ...options });
  if (result.error) return { status: null, stdout: "", stderr: result.error.message };
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function requireTool(cmd) {
  const probe = capture(cmd, ["--version"]);
  if (probe.status === null || probe.status !== 0) {
    fail(
      `Cannot run "${cmd}". This validator needs the tree-sitter CLI on PATH ` +
        `(checked with \`${cmd} --version\`).`,
    );
  }
  return probe.stdout.trim();
}

function loadKnownNodes(grammarDir) {
  const nodeTypesPath = path.join(grammarDir, "src", "node-types.json");
  if (!existsSync(nodeTypesPath)) {
    fail(
      `Missing ${path.relative(root, nodeTypesPath)}. The pinned grammar is cloned by Zed ` +
        `and is not committed; see README for setup.`,
    );
  }
  const nodeTypes = JSON.parse(readFileSync(nodeTypesPath, "utf8"));
  return new Set(nodeTypes.map((entry) => entry.type));
}

function ensureParserLibrary(grammarDir) {
  const lib = path.join(grammarDir, "plsql.dll");
  const sourceFiles = ["parser.c", "scanner.c"].map((name) => path.join(grammarDir, "src", name));
  const newestSource = Math.max(
    ...sourceFiles.filter((file) => existsSync(file)).map((file) => statSync(file).mtimeMs),
    0,
  );
  const fresh = existsSync(lib) && statSync(lib).mtimeMs >= newestSource;
  if (fresh) return lib;

  process.stdout.write(`building parser library from ${path.relative(root, grammarDir)} ...\n`);
  const result = capture("tree-sitter", ["build", grammarDir, "-o", lib]);
  if (result.status !== 0 || !existsSync(lib)) {
    fail(
      `Failed to build the parser library. A C compiler is required: ` +
        `\`tree-sitter build ${path.relative(root, grammarDir)}\` failed.\n` +
        `${(result.stdout + result.stderr).trim()}`,
    );
  }
  return lib;
}

function listCorpusFiles(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isFile()) files.push(full);
  }
  return files.sort();
}

function parseCorpus(lib, corpusDir, problems) {
  const files = listCorpusFiles(corpusDir);
  if (files.length === 0) {
    problems.push({ file: path.relative(root, corpusDir), message: `${path.relative(root, corpusDir)}: corpus is empty` });
    return 0;
  }
  for (const file of files) {
    const display = path.relative(root, file);
    const result = capture("tree-sitter", ["parse", "-l", lib, "--lang-name", "plsql", file]);
    if (result.status !== 0) {
      problems.push({ file: display, message: `${display}: parser failed to load or parse` });
      continue;
    }
    const tree = result.stdout;
    if (/\bERROR\b/.test(tree) || /\bMISSING\b/.test(tree)) {
      const firstError = tree.split(/\r?\n/).find((line) => /\bERROR\b|\bMISSING\b/.test(line));
      problems.push({
        file: display,
        message: `${display}: parse tree contains ERROR/MISSING node: ${firstError?.trim() ?? "unknown"}`,
      });
    }
  }
  return files.length;
}

function validateQueryFile(file, knownNodes, lib, problems) {
  const display = path.relative(root, file);
  if (!existsSync(file)) {
    problems.push({ file: display, message: `${display}: query file not found` });
    return 0;
  }
  const source = readFileSync(file, "utf8");
  let refs;
  try {
    refs = extractNodeRefs(source);
  } catch (error) {
    problems.push({ file: display, message: `${display}: malformed query: ${error.message}` });
    return 0;
  }
  problems.push(...findUnknownNodes(display, refs, knownNodes));

  if (lib) {
    const result = capture("tree-sitter", ["query", "-q", "-l", lib, "--lang-name", "plsql", file]);
    if (result.status !== 0) {
      const detail = (result.stdout + result.stderr).trim().split(/\r?\n/).slice(-3).join(" ");
      problems.push({ file: display, message: `${display}: query failed to compile against grammar: ${detail}` });
    }
  }
  return refs.length;
}

function validateConfigFile(file, problems) {
  const display = path.relative(root, file);
  if (!existsSync(file)) {
    problems.push({ file: display, message: `${display}: config file not found` });
    return;
  }
  const source = readFileSync(file, "utf8");
  problems.push(...validateTomlSyntax(source, display).map((problem) => ({ file: display, ...problem })));
  problems.push(...validateBrackets(source, display).map((problem) => ({ file: display, ...problem })));
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    fail(`${error.message}\n\n${USAGE}`);
  }

  const version = requireTool("tree-sitter");
  process.stdout.write(`tree-sitter ${version}\n`);

  const knownNodes = loadKnownNodes(options.grammar);
  process.stdout.write(`grammar node types: ${knownNodes.size}\n`);

  const lib = options.parseCorpus ? ensureParserLibrary(options.grammar) : null;
  const problems = [];

  let parsed = 0;
  if (options.parseCorpus) {
    parsed = parseCorpus(lib, options.corpus, problems);
  }

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
