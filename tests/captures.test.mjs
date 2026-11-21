import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCaptureOutput } from "../scripts/lib/captures.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const probe = path.join(root, "tests", "fixtures", "highlights", "probe.pks");

test("parseCaptureOutput reads capture name, row, column and text", () => {
  const output = [
    probe,
    "    pattern:  0, capture: 0 - comment, start: (0, 0), end: (0, 15), text: `-- line comment`",
    "    pattern: 25, capture: 8 - keyword, start: (3, 0), end: (3, 6), text: `CREATE`",
  ].join("\n");
  const captures = parseCaptureOutput(output, root);
  assert.deepEqual(
    captures.map((entry) => [entry.capture, entry.row, entry.column, entry.text]),
    [
      ["comment", 0, 0, "-- line comment"],
      ["keyword", 3, 0, "CREATE"],
    ],
  );
});

test("parseCaptureOutput slices multi-line captures from the source file", () => {
  const output = [
    probe,
    "    pattern:  1, capture: 0 - comment, start: (1, 0), end: (2, 13), text: `/* block",
    "   comment */`",
  ].join("\n");
  const captures = parseCaptureOutput(output, root);
  assert.equal(captures.length, 1);
  assert.equal(captures[0].capture, "comment");
  assert.equal(captures[0].text, "/* block\n   comment */");
  assert.equal(captures[0].file, path.join("tests", "fixtures", "highlights", "probe.pks"));
});

test("parseCaptureOutput ignores bare file headers without captures", () => {
  const output = [path.join(root, "corpus", "plsql", "package_spec.pks"), "   "].join("\n");
  assert.deepEqual(parseCaptureOutput(output, root), []);
});
