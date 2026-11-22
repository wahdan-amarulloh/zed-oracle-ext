import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "extension.toml");

// Zed names a snippet file after the language's `snippet_scope_id()`: the language
// name lowercased with `/` and `\` stripped (crates/language_core/src/language_name.rs).
// `PL/SQL` therefore resolves to `plsql`. The snippet file is registered at the root
// of `extension.toml` and the registry keys it by the file stem.
const SCOPE_ID = "plsql";

// Snippet counts the spec fixes: structural-only, ~12-15 (spec #1, user story 23).
const MIN_STRUCTURAL_SNIPPETS = 12;
const MAX_STRUCTURAL_SNIPPETS = 15;

// Reads `snippets = [...]` at the top level of extension.toml. A bare key after a
// `[table]` header belongs to that table, so the key must appear before any header;
// a nested `snippets` key never reaches Zed's manifest deserializer.
function rootSnippets(source) {
  const firstTable = source.search(/^\s*\[/m);
  const preamble = firstTable === -1 ? source : source.slice(0, firstTable);
  const match = preamble.match(/^\s*snippets\s*=\s*(\[[^\]]*\]|"[^"]*")/m);
  if (!match) return null;
  const raw = match[1];
  if (raw.startsWith('"')) return [raw.slice(1, -1)];
  return [...raw.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
}

function loadSnippetFile() {
  const paths = rootSnippets(readFileSync(manifestPath, "utf8"));
  assert.deepEqual(paths, [`./snippets/${SCOPE_ID}.json`], "extension.toml must register the PL/SQL snippet file at root level");
  const relative = paths[0];
  const absolute = path.resolve(root, relative);
  assert.ok(existsSync(absolute), `registered snippet file is missing: ${relative}`);
  const json = JSON.parse(readFileSync(absolute, "utf8"));
  assert.equal(typeof json, "object");
  assert.ok(json !== null && !Array.isArray(json), "snippet file must be a JSON object");
  assert.ok(Object.keys(json).length > 0, "snippet file must not be empty");
  return json;
}

function eachSnippet(json, visit) {
  for (const [name, snippet] of Object.entries(json)) {
    assert.ok(name.trim().length > 0, "snippet name must not be blank");
    assert.ok(snippet && typeof snippet === "object", `${name} must be an object`);
    visit(name, snippet);
  }
}

// Placeholder numbers used inside `${n:...}`; a tab stop nested in another is not
// valid snippet syntax and is rejected by Zed's parser.
function tabStops(body) {
  const stops = new Set();
  for (const line of body) {
    for (const [placeholder, inner] of line.matchAll(/\$\{(\d+):([^}]*)\}/g)) {
      stops.add(Number(placeholder));
      assert.ok(
        !/\$\{\d+:/.test(inner),
        `nested tab stop inside \${${placeholder}:...}: ${line}`,
      );
    }
    for (const plain of line.matchAll(/\$(\d+)/g)) stops.add(Number(plain[1]));
  }
  return stops;
}

test("extension.toml registers the snippet file at root level under the PL/SQL scope id", () => {
  const source = readFileSync(manifestPath, "utf8");
  const paths = rootSnippets(source);
  assert.deepEqual(paths, [`./snippets/${SCOPE_ID}.json`]);
  assert.equal(path.basename(paths[0], ".json"), SCOPE_ID);
  assert.ok(
    !/^\s*snippets\s*=/m.test(source.slice(source.search(/^\s*\[/m))),
    "snippets must not be declared inside a [table]",
  );
});

test("snippet file is valid JSON", () => {
  const snippets = loadSnippetFile();
  assert.ok(Object.keys(snippets).length >= MIN_STRUCTURAL_SNIPPETS);
});

test("every snippet has a name, prefix and body with a tab stop", () => {
  eachSnippet(loadSnippetFile(), (name, snippet) => {
    assert.ok(
      typeof snippet.prefix === "string" && snippet.prefix.trim().length > 0,
      `${name} must have a non-empty prefix`,
    );
    assert.ok(
      Array.isArray(snippet.body) && snippet.body.length > 0,
      `${name} must have a non-empty body array`,
    );
    for (const line of snippet.body) {
      assert.equal(typeof line, "string", `${name} body lines must be strings`);
    }
    assert.ok(tabStops(snippet.body).size > 0, `${name} must contain a tab stop`);
  });
});

test("snippet set is structural-only within the spec's size budget", () => {
  const snippets = Object.values(loadSnippetFile());
  assert.ok(snippets.length >= MIN_STRUCTURAL_SNIPPETS, "too few structural snippets");
  assert.ok(snippets.length <= MAX_STRUCTURAL_SNIPPETS, "too many snippets: keep it structural-only");
  const prefixes = snippets.map((snippet) => snippet.prefix);
  assert.equal(new Set(prefixes).size, prefixes.length, "prefixes must be unique");
});

test("snippet bodies carry no DML and no builtin-function snippets", () => {
  const forbiddenStatements = [
    /\bINSERT\s+INTO\b/i,
    /\bUPDATE\s+\w+\s+SET\b/i,
    /\bDELETE\s+FROM\b/i,
    /\bMERGE\s+INTO\b/i,
    /\bCOMMIT\b/i,
    /\bROLLBACK\b/i,
  ];
  const builtinFunctions = [
    "DBMS_OUTPUT",
    "NVL",
    "COALESCE",
    "SYSDATE",
    "SYSTIMESTAMP",
    "ROWNUM",
    "SUBSTR",
    "TO_CHAR",
    "TO_DATE",
  ];
  eachSnippet(loadSnippetFile(), (name, snippet) => {
    const text = snippet.body.join("\n");
    for (const pattern of forbiddenStatements) {
      assert.ok(!pattern.test(text), `${name} must not contain DML (${pattern})`);
    }
    for (const builtin of builtinFunctions) {
      assert.ok(
        !new RegExp(`\\b${builtin}\\b`).test(text),
        `${name} must not reference builtin ${builtin}`,
      );
    }
  });
});

test("snippet prefixes are lowercase PL/SQL block triggers", () => {
  eachSnippet(loadSnippetFile(), (name, snippet) => {
    assert.match(snippet.prefix, /^[a-z][a-z-]*$/, `${name} prefix must be lowercase`);
  });
});

test("structural snippets close their block", () => {
  const closers = {
    "pkg-spec": /END\s+\$\{\d+:[\w]+\};/,
    "pkg-body": /END\s+\$\{\d+:[\w]+\};/,
    "proc": /END\s+\$\{\d+:[\w]+\};/,
    "func": /END\s+\$\{\d+:[\w]+\};/,
    "trg": /END\s+\$\{\d+:[\w]+\};/,
    "if": /END\s+IF;/,
    "case": /END\s+CASE;/,
    "loop": /END\s+LOOP;/,
    "while": /END\s+LOOP;/,
    "for-loop": /END\s+LOOP;/,
    "cur-loop": /END\s+LOOP;/,
  };
  const byPrefix = new Map(Object.values(loadSnippetFile()).map((snippet) => [snippet.prefix, snippet]));
  for (const [prefix, pattern] of Object.entries(closers)) {
    const snippet = byPrefix.get(prefix);
    assert.ok(snippet, `missing snippet with prefix ${prefix}`);
    assert.match(snippet.body.join("\n"), pattern, `${prefix} must close its block`);
  }
});
