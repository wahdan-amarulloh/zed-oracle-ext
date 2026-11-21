#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractNodeRefs,
  findUnknownNodes,
  validateBrackets,
  validateTomlSyntax,
} from "./lib/query-validation.mjs";
import {
  ensureParserLibrary,
  loadKnownNodes,
  resolveTreeSitter,
  run,
  fail,
} from "./lib/grammar-tools.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const languageDir = path.join(root, "languages", "plsql");

const USAGE = `Usage: node scripts/validate-queries.mjs [options]

Options:
  --query <file>     Query file to validate (repeatable; defaults to every
                     languages/plsql/*.scm: highlights.scm, brackets.scm, ...)
  --config <file>    Language config.toml to validate (default languages/plsql/config.toml)
  --corpus <dir>     PL/SQL corpus directory to parse (default corpus/plsql)
  --grammar <dir>    Pinned grammar directory (default grammars/plsql)
  --no-parse         Skip parsing the corpus (query and config checks still run)
  -h, --help         Show this help

Exits 0 when every check passes, 1 when the repo has problems, and 2 when a
required tool or input is missing.
`;

function languageQueries(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((entry) => entry.endsWith(".scm"))
    .map((entry) => path.join(dir, entry))
    .sort();
}

function parseArgs(argv) {
  const options = {
    queries: [],
    config: path.join(languageDir, "config.toml"),
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
    options.queries = languageQueries(languageDir);
    if (options.queries.length === 0) {
      fail(`No query files found in ${path.relative(root, languageDir)}.`);
    }
  }
  return options;
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

  const knownNodes = loadKnownNodes(options.grammar, root);
  const lib = ensureParserLibrary(options.grammar, root);
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
