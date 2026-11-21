import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { run } from "./grammar-tools.mjs";

const CAPTURE_HEADER =
  /^\s*pattern:\s*\d+,\s*capture:\s*\d+\s+-\s+(\S+),\s+start:\s+\((\d+),\s+(\d+)\),\s+end:\s+\((\d+),\s+(\d+)\)/;

function lineOffsets(buffer) {
  const offsets = [0];
  for (let index = 0; index < buffer.length; index += 1) {
    if (buffer[index] === 0x0a) offsets.push(index + 1);
  }
  return offsets;
}

function textAt(source, offsets, start, end) {
  const from = offsets[start[0]] + start[1];
  const to = offsets[end[0]] + end[1];
  return source.subarray(from, to).toString("utf8");
}

export function parseCaptureOutput(stdout, root) {
  const captures = [];
  let file = null;
  let source = null;
  let offsets = null;
  for (const line of stdout.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    const match = CAPTURE_HEADER.exec(line);
    if (!match) {
      const absolute = path.resolve(root, line);
      if (existsSync(absolute)) {
        file = line.trim();
        source = readFileSync(absolute);
        offsets = lineOffsets(source);
      }
      continue;
    }
    if (!source) continue;
    captures.push({
      file: file ? path.relative(root, path.resolve(file)) : null,
      capture: match[1],
      row: Number(match[2]),
      column: Number(match[3]),
      text: textAt(
        source,
        offsets,
        [Number(match[2]), Number(match[3])],
        [Number(match[4]), Number(match[5])],
      ),
    });
  }
  return captures;
}

export function collectCaptures({ queryFile, sources, lib, root }) {
  const result = run("tree-sitter", [
    "query",
    "-c",
    "-l",
    lib,
    "--lang-name",
    "plsql",
    queryFile,
    ...sources,
  ]);
  return {
    status: result.status,
    stderr: result.stderr,
    captures: parseCaptureOutput(result.stdout, root),
  };
}

export function capturesOn(queryFile, sourceFile, { lib, root }) {
  if (!existsSync(queryFile)) throw new Error(`query file not found: ${queryFile}`);
  if (!existsSync(sourceFile)) throw new Error(`source file not found: ${sourceFile}`);
  const { status, stderr, captures } = collectCaptures({
    queryFile,
    sources: [sourceFile],
    lib,
    root,
  });
  if (status !== 0) throw new Error(stderr.trim() || "tree-sitter query failed");
  return captures;
}

export function textsWith(captures, captureName) {
  return captures.filter((entry) => entry.capture === captureName).map((entry) => entry.text);
}

export function capturesOfText(captures, text) {
  return captures.filter((entry) => entry.text === text).map((entry) => entry.capture);
}
