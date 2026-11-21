import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractNodeRefs,
  findUnknownNodes,
  validateBrackets,
} from "../scripts/lib/query-validation.mjs";

test("extractNodeRefs attaches capture to a single node", () => {
  const refs = extractNodeRefs("(comment_sl) @comment\n");
  assert.deepEqual(refs, [{ node: "comment_sl", capture: "comment", line: 1 }]);
});

test("extractNodeRefs applies a bracket-group capture to every member", () => {
  const src = "[\n  (kw_begin) (kw_end)\n] @keyword\n";
  const refs = extractNodeRefs(src);
  assert.deepEqual(
    refs.map((r) => [r.node, r.capture]),
    [
      ["kw_begin", "keyword"],
      ["kw_end", "keyword"],
    ],
  );
});

test("extractNodeRefs keeps inline captures separate", () => {
  const src = "(identifier) @variable\n(label) @label\n";
  const refs = extractNodeRefs(src);
  assert.deepEqual(
    refs.map((r) => [r.node, r.capture, r.line]),
    [
      ["identifier", "variable", 1],
      ["label", "label", 2],
    ],
  );
});

test("extractNodeRefs reads field-prefixed and nested nodes", () => {
  const src = "(function_declaration fn_name: (identifier) @function.name)\n";
  const refs = extractNodeRefs(src);
  assert.deepEqual(
    refs.map((r) => [r.node, r.capture]),
    [
      ["function_declaration", null],
      ["identifier", "function.name"],
    ],
  );
});

test("extractNodeRefs ignores comments, predicates and anonymous nodes", () => {
  const src = [
    '; (ghost_node) @ghost',
    '(identifier) @variable (#match? @variable "^[A-Z]")',
    '("BEGIN") @keyword',
  ].join("\n");
  const refs = extractNodeRefs(src);
  assert.deepEqual(
    refs.map((r) => [r.node, r.capture]),
    [["identifier", "variable"]],
  );
});

test("extractNodeRefs strips negation and anchors a negated node's capture", () => {
  const src = "(identifier) @variable\n(!keyword) @punctuation\n";
  const refs = extractNodeRefs(src);
  assert.deepEqual(
    refs.map((r) => [r.node, r.capture]),
    [
      ["identifier", "variable"],
      ["keyword", "punctuation"],
    ],
  );
});

test("extractNodeRefs keeps the capture when the node is quantified", () => {
  const src = "(identifier)? @variable\n(comment_sl)* @comment\n";
  const refs = extractNodeRefs(src);
  assert.deepEqual(
    refs.map((r) => [r.node, r.capture]),
    [
      ["identifier", "variable"],
      ["comment_sl", "comment"],
    ],
  );
});

test("findUnknownNodes names the query file, capture and node", () => {
  const problems = findUnknownNodes(
    "languages/plsql/highlights.scm",
    [{ node: "kw_bogus", capture: "keyword", line: 3 }],
    new Set(["kw_begin"]),
  );
  assert.equal(problems.length, 1);
  assert.match(problems[0].message, /languages\/plsql\/highlights\.scm/);
  assert.match(problems[0].message, /kw_bogus/);
  assert.match(problems[0].message, /keyword/);
  assert.match(problems[0].message, /line 3/);
});

test("findUnknownNodes allows wildcards", () => {
  const problems = findUnknownNodes(
    "q.scm",
    [
      { node: "_", capture: "variable", line: 1 },
      { node: "_field", capture: "variable", line: 2 },
    ],
    new Set(["identifier"]),
  );
  assert.deepEqual(problems, []);
});

test("findUnknownNodes rejects a real node missing from the grammar", () => {
  const problems = findUnknownNodes(
    "q.scm",
    [{ node: "kw_begin", capture: "keyword", line: 1 }],
    new Set(["kw_end"]),
  );
  assert.equal(problems.length, 1);
});

test("validateBrackets flags a [[brackets]] entry missing close and newline", () => {
  const toml = '[[brackets]]\nstart = "("\nend = ")"\n';
  const problems = validateBrackets(toml);
  assert.equal(problems.length, 2);
  assert.ok(problems.some((p) => /close/.test(p.message)));
  assert.ok(problems.some((p) => /newline/.test(p.message)));
});

test("validateBrackets flags a missing newline only", () => {
  const toml = '[[brackets]]\nstart = "("\nend = ")"\nclose = true\n';
  const problems = validateBrackets(toml);
  assert.equal(problems.length, 1);
  assert.match(problems[0].message, /newline/);
  assert.match(problems[0].message, /brackets\[1\]/);
});

test("validateBrackets passes complete bracket tables", () => {
  const toml = [
    "[[brackets]]",
    'start = "("',
    'end = ")"',
    "close = true",
    "newline = false",
    "",
    "[[brackets]]",
    'start = "\'"',
    'end = "\'"',
    "close = true",
    "newline = false",
    'not_in = ["comment", "string"]',
  ].join("\n");
  assert.deepEqual(validateBrackets(toml), []);
});
