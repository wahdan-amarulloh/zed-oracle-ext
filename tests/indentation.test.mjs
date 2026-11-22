import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const languageDir = path.join(root, "languages", "plsql");
const configPath = path.join(languageDir, "config.toml");
const INDENT = 4;

function tomlLiteral(source, key) {
  const match = source.match(new RegExp(`^\\s*${key}\\s*=\\s*'([^']*)'`, "m"));
  return match ? match[1] : null;
}

function regexFromPattern(pattern) {
  if (pattern.startsWith("(?i)")) return new RegExp(pattern.slice(4), "i");
  return new RegExp(pattern);
}

function readPatterns() {
  const source = readFileSync(configPath, "utf8");
  const increase = tomlLiteral(source, "increase_indent_pattern");
  const decrease = tomlLiteral(source, "decrease_indent_pattern");
  assert.ok(increase, "config.toml must define increase_indent_pattern");
  assert.ok(decrease, "config.toml must define decrease_indent_pattern");
  return {
    increase: regexFromPattern(increase),
    decrease: regexFromPattern(decrease),
  };
}

// Simulation of Zed's line-pattern indentation, not a conformance test of Zed itself:
// the real engine lives in crates/language/src/buffer.rs `suggest_autoindents`. A
// matching increase line indents the following row one level, a matching decrease line
// outdents that row one level, and a row matched by both keeps the previous row's indent.
function indentsFor(lines, { increase, decrease }) {
  const indents = [0];
  for (let row = 1; row < lines.length; row += 1) {
    const opens = increase.test(lines[row - 1]);
    const closes = decrease.test(lines[row]);
    const previous = indents[row - 1];
    if (opens && closes) indents.push(previous);
    else if (opens) indents.push(previous + INDENT);
    else if (closes) indents.push(Math.max(0, previous - INDENT));
    else indents.push(previous);
  }
  return indents;
}

const blocks = [
  {
    name: "anonymous block opens on DECLARE and BEGIN",
    lines: ["DECLARE", "v_count NUMBER;", "BEGIN", "v_count := 1;", "END;"],
    expected: [0, 4, 0, 4, 0],
  },
  {
    name: "IF/ELSIF/ELSE branch lines align with IF",
    lines: [
      "IF v_flag THEN",
      "v_a := 1;",
      "ELSIF v_other THEN",
      "v_a := 2;",
      "ELSE",
      "v_a := 3;",
      "END IF;",
    ],
    expected: [0, 4, 0, 4, 0, 4, 0],
  },
  {
    name: "END IF aligns with its IF, not one level under it",
    lines: ["IF v_flag THEN", "IF v_nested THEN", "v_a := 1;", "END IF;", "END IF;"],
    expected: [0, 4, 8, 4, 0],
  },
  {
    name: "LOOP forms open and END LOOP closes",
    lines: [
      "FOR i IN 1 .. 10 LOOP",
      "DBMS_OUTPUT.PUT_LINE(i);",
      "END LOOP;",
      "LOOP",
      "EXIT WHEN v_done;",
      "END LOOP;",
    ],
    expected: [0, 4, 0, 0, 4, 0],
  },
  {
    name: "CASE branches align with CASE and END CASE",
    lines: [
      "CASE v_status",
      "WHEN 'A' THEN",
      "v_a := 1;",
      "WHEN 'B' THEN",
      "v_a := 2;",
      "END CASE;",
    ],
    expected: [0, 0, 4, 0, 4, 0],
  },
  {
    name: "EXCEPTION outdents and handlers align with it",
    lines: [
      "BEGIN",
      "v_x := 1;",
      "EXCEPTION",
      "WHEN NO_DATA_FOUND THEN",
      "v_x := 0;",
      "WHEN OTHERS THEN",
      "NULL;",
      "END;",
    ],
    expected: [0, 4, 0, 0, 4, 0, 4, 0],
  },
  {
    name: "unit header IS indents the body and BEGIN aligns with the header",
    lines: [
      "CREATE OR REPLACE PROCEDURE p IS",
      "v_x NUMBER;",
      "BEGIN",
      "NULL;",
      "END p;",
    ],
    expected: [0, 4, 0, 4, 0],
  },
  {
    name: "package body nests subprogram units",
    lines: [
      "CREATE OR REPLACE PACKAGE BODY pkg AS",
      "PROCEDURE inner IS",
      "v_x NUMBER;",
      "BEGIN",
      "NULL;",
      "END inner;",
      "BEGIN",
      "NULL;",
      "END pkg;",
    ],
    expected: [0, 4, 8, 4, 8, 4, 0, 4, 0],
  },
  {
    name: "keywords are matched case-insensitively",
    lines: ["begin", "if x then", "null;", "end if;", "end;"],
    expected: [0, 4, 8, 4, 0],
  },
];

test("config.toml ships line-pattern indentation, not an indents query", () => {
  const queries = readdirSync(languageDir).filter((entry) => entry.endsWith(".scm"));
  assert.ok(!queries.includes("indents.scm"), "indentation must not use an indents.scm query");
  readPatterns();
});

for (const block of blocks) {
  test(`auto-indent: ${block.name}`, () => {
    assert.deepEqual(indentsFor(block.lines, readPatterns()), block.expected, block.lines.join("\n"));
  });
}

test("closing lines outdent and never open a block", () => {
  const { decrease, increase } = readPatterns();
  for (const line of ["END;", "END IF;", "END LOOP;", "END CASE;", "END pkg;", "EXCEPTION"]) {
    assert.ok(decrease.test(line), `expected ${line} to outdent`);
    assert.ok(!increase.test(line), `expected ${line} not to indent the next line`);
  }
  for (const partial of ["END LOOP", "END CASE", "end loop"]) {
    assert.ok(!increase.test(partial), `expected unfinished ${partial} not to indent the next line`);
  }
});

test("branch lines outdent but still indent their own body", () => {
  const { decrease, increase } = readPatterns();
  for (const line of ["  ELSIF x THEN", "    WHEN OTHERS THEN", "  ELSE"]) {
    assert.ok(decrease.test(line), `expected ${line} to outdent`);
    assert.ok(increase.test(line), `expected ${line} to indent its branch body`);
  }
});

test("comment lines are not treated as block openers or closers", () => {
  const { increase, decrease } = readPatterns();
  for (const line of ["-- BEGIN the work", "-- IF x THEN", "  -- CASE v_status", "-- LOOP"]) {
    assert.ok(!increase.test(line), `expected comment ${line} not to indent the next line`);
    assert.ok(!decrease.test(line), `expected comment ${line} not to outdent`);
  }
});

test("trailing line comments do not hide opened blocks", () => {
  const { increase } = readPatterns();
  assert.ok(increase.test("BEGIN -- start of block"));
  assert.ok(increase.test("IF v_flag THEN -- guard"));
});

test("unit headers open a block but plain AS aliases do not", () => {
  const { increase } = readPatterns();
  for (const header of [
    "CREATE OR REPLACE PACKAGE BODY pkg AS",
    "CREATE OR REPLACE PACKAGE pkg IS",
    "FUNCTION f RETURN NUMBER AS",
    "PROCEDURE inner IS",
  ]) {
    assert.ok(increase.test(header), `expected unit header ${header} to indent`);
  }
  assert.ok(!increase.test("SELECT ename AS name FROM emp;"), "plain AS alias must not indent");
  assert.ok(!increase.test("END;"), "END must not indent the next line");
  assert.ok(
    !increase.test("v_x := CASE WHEN 1 THEN 2 END;"),
    "single-line CASE expression must not indent",
  );
});

test("nested blocks indent one level per opener", () => {
  const lines = [
    "BEGIN",
    "IF v_a THEN",
    "FOR i IN 1 .. 3 LOOP",
    "IF v_b THEN",
    "NULL;",
    "END IF;",
    "END LOOP;",
    "END IF;",
    "END;",
  ];
  assert.deepEqual(indentsFor(lines, readPatterns()), [0, 4, 8, 12, 16, 12, 8, 4, 0]);
});

test("END LOOP and END CASE do not indent the line after them", () => {
  const { increase } = readPatterns();
  for (const closer of ["END LOOP;", "END CASE;", "end loop;", "END pkg;", "END LOOP", "END CASE"]) {
    assert.ok(!increase.test(closer), `expected ${closer} not to indent the next line`);
  }
});
test("a CASE statement that opens and closes on one line does not indent", () => {
  const { increase } = readPatterns();
  assert.ok(
    !increase.test("CASE WHEN v_a = 1 THEN 2 ELSE 3 END;"),
    "complete single-line CASE must not indent the next line",
  );
  assert.ok(increase.test("CASE v_status"), "CASE header still opens a block");
});

test("loop headers open a block", () => {
  const { increase } = readPatterns();
  for (const header of [
    "LOOP",
    "loop",
    "FOR i IN 1 .. 10 LOOP",
    "FOR rec IN (SELECT id FROM t) LOOP",
    "WHILE v_i < 10 LOOP",
    "WHILE v_i < 10 LOOP -- count up",
  ]) {
    assert.ok(increase.test(header), `expected ${header} to indent`);
  }
  assert.ok(!increase.test("DBMS_OUTPUT.PUT_LINE('loop');"), "a string mentioning loop must not indent");
});
