import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts", "validate-queries.mjs");

function exec(params = []) {
  return run(process.execPath, [script, ...params], { cwd: root, encoding: "utf8" }).then(
    (result) => ({ code: 0, ...result }),
    (error) => ({ code: error.code ?? 1, stdout: error.stdout ?? "", stderr: error.stderr ?? "" }),
  );
}

test("validator passes on the committed corpus and highlights", async () => {
  const result = await exec();
  assert.equal(result.code, 0, result.stdout + result.stderr);
  assert.doesNotMatch(result.stdout, /unknown node/i);
});

test("validator exits nonzero and names file, capture and node on a bad query", async () => {
  const badQuery = path.join(root, "tests", "fixtures", "bad-highlights.scm");
  const result = await exec(["--query", badQuery]);
  assert.notEqual(result.code, 0);
  const output = result.stdout + result.stderr;
  assert.match(output, /bad-highlights\.scm/);
  assert.match(output, /kw_definitely_not_a_node/);
  assert.match(output, /@keyword/);
});

test("validator exits nonzero when config.toml omits a brackets close field", async () => {
  const badConfig = path.join(root, "tests", "fixtures", "bad-config.toml");
  const result = await exec(["--config", badConfig]);
  assert.notEqual(result.code, 0);
  const output = result.stdout + result.stderr;
  assert.match(output, /bad-config\.toml/);
  assert.match(output, /"close"|"newline"/);
});

test("validator reports a syntax error when a corpus file does not parse", async () => {
  const brokenCorpus = path.join(root, "tests", "fixtures");
  const result = await exec(["--corpus", brokenCorpus]);
  assert.notEqual(result.code, 0);
  const output = result.stdout + result.stderr;
  assert.match(output, /broken-corpus\.pks/);
  assert.match(output, /ERROR|MISSING|parse/i);
});

test("validator rejects an unknown grammar directory instead of silently passing", async () => {
  const result = await exec(["--grammar", path.join(root, "tests", "fixtures")]);
  assert.notEqual(result.code, 0);
  assert.match(result.stdout + result.stderr, /node-types\.json/);
});
