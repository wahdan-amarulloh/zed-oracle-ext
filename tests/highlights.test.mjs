import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { capturesOfText, capturesOn, textsWith } from "../scripts/lib/captures.mjs";
import { ensureParserLibrary } from "../scripts/lib/grammar-tools.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const grammar = path.join(root, "grammars", "plsql");
const lib = ensureParserLibrary(grammar, root);
const highlights = path.join(root, "languages", "plsql", "highlights.scm");
const brackets = path.join(root, "languages", "plsql", "brackets.scm");
const probe = path.join(root, "tests", "fixtures", "highlights", "probe.pks");

const contexts = new Map();
function captures(file = highlights, source = probe) {
  const key = `${file}\u0000${source}`;
  if (!contexts.has(key)) contexts.set(key, capturesOn(file, source, { lib, root }));
  return contexts.get(key);
}

test("PL/SQL block keywords are captured as keywords", () => {
  const seen = captures();
  for (const word of ["BEGIN", "END", "IF", "THEN", "ELSIF", "CASE", "LOOP", "EXCEPTION", "RAISE"]) {
    assert.ok(textsWith(seen, "keyword").includes(word), `expected ${word} to be @keyword`);
  }
});

test("keywords are distinguished from identifiers", () => {
  const seen = captures();
  for (const name of ["probe_all", "p_id", "v_rate"]) {
    const tags = capturesOfText(seen, name);
    assert.ok(tags.includes("variable"), `expected ${name} to be @variable, got ${tags.join(",")}`);
    assert.ok(!tags.includes("keyword"), `expected ${name} not to be @keyword`);
  }
});

test("built-in PL/SQL types are highlighted", () => {
  const types = textsWith(captures(), "type.builtin");
  for (const type of ["VARCHAR2", "NUMBER", "PLS_INTEGER", "CLOB", "BLOB", "TIMESTAMP"]) {
    assert.ok(types.includes(type), `expected ${type} to be @type.builtin`);
  }
});

test("comments, strings, numbers and operators are highlighted", () => {
  const seen = captures();
  assert.ok(
    seen.some((entry) => entry.capture === "comment" && entry.text.startsWith("-- line comment")),
    "expected a line comment capture",
  );
  assert.ok(
    seen.some((entry) => entry.capture === "comment" && entry.text.includes("block")),
    "expected a block comment capture",
  );
  for (const literal of ["'one'", "'boom'"]) {
    assert.ok(textsWith(seen, "string").includes(literal), `expected ${literal} to be @string`);
  }
  for (const literal of ["1000", "3.5"]) {
    assert.ok(textsWith(seen, "number").includes(literal), `expected ${literal} to be @number`);
  }
  const operators = textsWith(seen, "operator");
  for (const operator of [":=", "*", "/", ">", "||", ">=", "<>"]) {
    assert.ok(operators.includes(operator), `expected ${operator} to be @operator`);
  }
});

test("parentheses are captured as matching brackets", () => {
  const seen = captures(brackets);
  const opens = textsWith(seen, "open");
  const closes = textsWith(seen, "close");
  assert.ok(opens.length > 0, "expected at least one @open capture");
  assert.ok(opens.every((text) => text === "("), `@open should only capture "(": ${opens.join(",")}`);
  assert.ok(closes.every((text) => text === ")"), `@close should only capture ")": ${closes.join(",")}`);
  assert.equal(opens.length, closes.length, "every opening parenthesis needs a closing one");
});

test("subprogram names and calls are captured as functions", () => {
  const seen = captures(highlights, path.join(root, "corpus", "plsql", "procedure.prc"));
  assert.ok(textsWith(seen, "function").includes("adjust_salaries"));

  const exceptions = captures(highlights, path.join(root, "corpus", "plsql", "exception_handler.prc"));
  const builtins = textsWith(exceptions, "function.builtin");
  assert.ok(builtins.includes("RAISE_APPLICATION_ERROR"), "expected RAISE_APPLICATION_ERROR to be @function.builtin");
});

test("predefined exceptions and user-defined types are highlighted", () => {
  const seen = captures(highlights, path.join(root, "corpus", "plsql", "exception_handler.prc"));
  const constants = textsWith(seen, "constant.builtin");
  for (const name of ["ZERO_DIVIDE", "NO_DATA_FOUND", "TOO_MANY_ROWS", "VALUE_ERROR"]) {
    assert.ok(constants.includes(name), `expected ${name} to be @constant.builtin`);
  }

  const spec = captures(highlights, path.join(root, "corpus", "plsql", "package_spec.pks"));
  assert.ok(textsWith(spec, "type").includes("ref_cursor"), "expected the ref cursor type name to be @type");
});
