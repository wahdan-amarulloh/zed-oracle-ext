const IGNORED_ATOMS = new Set(["?", "*", "+", ".", "=", "#"]);

function tokenize(src) {
  const tokens = [];
  let i = 0;
  let line = 1;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "\n") {
      line += 1;
      i += 1;
    } else if (ch === " " || ch === "\t" || ch === "\r") {
      i += 1;
    } else if (ch === ";") {
      while (i < src.length && src[i] !== "\n") i += 1;
    } else if (ch === "(" || ch === ")" || ch === "[" || ch === "]") {
      tokens.push({ kind: ch, line });
      i += 1;
    } else if (ch === '"') {
      let value = "";
      i += 1;
      while (i < src.length && src[i] !== '"') {
        if (src[i] === "\\" && i + 1 < src.length) {
          value += src[i + 1];
          i += 2;
          continue;
        }
        if (src[i] === "\n") line += 1;
        value += src[i];
        i += 1;
      }
      i += 1;
      tokens.push({ kind: "string", value, line });
    } else {
      let value = "";
      while (i < src.length && !/[\s()\[\]";]/.test(src[i])) {
        value += src[i];
        i += 1;
      }
      tokens.push({ kind: "atom", value, line });
    }
  }
  return tokens;
}

function parseExprs(tokens, start, terminator) {
  const exprs = [];
  let i = start;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token.kind === terminator) return { exprs, next: i + 1 };
    if (token.kind === "(" || token.kind === "[") {
      const close = token.kind === "(" ? ")" : "]";
      const inner = parseExprs(tokens, i + 1, close);
      exprs.push({
        kind: token.kind === "(" ? "paren" : "bracket",
        line: token.line,
        children: inner.exprs,
        capture: null,
      });
      i = inner.next;
    } else if (token.kind === ")" || token.kind === "]") {
      throw new Error(`unbalanced ${token.kind === ")" ? ")" : "]"} at line ${token.line}`);
    } else {
      exprs.push({ kind: token.kind, value: token.value, line: token.line });
      i += 1;
    }
  }
  if (terminator) {
    throw new Error(`missing ${terminator} at end of query`);
  }
  return { exprs, next: i };
}

function nodeName(expr) {
  if (expr.kind !== "paren") return null;
  const first = expr.children.find(
    (child) => child.kind === "atom" && !child.value.endsWith(":") && !child.value.startsWith("@"),
  );
  if (!first || first.value.startsWith("#") || IGNORED_ATOMS.has(first.value)) return null;
  return first;
}

function assignCaptures(exprs) {
  for (let index = 0; index < exprs.length; index += 1) {
    const expr = exprs[index];
    if (expr.kind === "atom" && expr.value.startsWith("@")) {
      const previous = exprs[index - 1];
      if (previous && (previous.kind === "paren" || previous.kind === "bracket")) {
        previous.capture = expr.value.slice(1);
      }
      continue;
    }
    if (expr.kind === "paren" || expr.kind === "bracket") {
      assignCaptures(expr.children);
    }
  }
}

function collectRefs(exprs, inheritedCapture, out) {
  for (const expr of exprs) {
    if (expr.kind === "atom") continue;
    if (expr.kind === "paren") {
      const name = nodeName(expr);
      if (name) {
        out.push({
          node: name.value,
          capture: expr.capture ?? inheritedCapture ?? null,
          line: name.line,
        });
      }
      collectRefs(expr.children, null, out);
    } else if (expr.kind === "bracket") {
      collectRefs(expr.children, expr.capture ?? inheritedCapture ?? null, out);
    }
  }
  return out;
}

export function extractNodeRefs(src) {
  const { exprs } = parseExprs(tokenize(src), 0, null);
  assignCaptures(exprs);
  return collectRefs(exprs, null, []);
}

export function findUnknownNodes(file, refs, knownNodes) {
  const problems = [];
  for (const ref of refs) {
    if (ref.node === "_" || ref.node.startsWith("_")) continue;
    if (knownNodes.has(ref.node)) continue;
    const capture = ref.capture ? ` @${ref.capture}` : "";
    problems.push({
      file,
      line: ref.line,
      node: ref.node,
      capture: ref.capture,
      message: `${file} line ${ref.line}: unknown node "${ref.node}"${capture}`,
    });
  }
  return problems;
}

const TOML_LINE = /^\s*(\[\[?[^\].]+?\]?\]|#.*|[A-Za-z0-9_.-]+\s*=\s*.+)\s*$/;

function balancedStrings(line) {
  let quote = null;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quote) {
      if (ch === "\\") {
        i += 1;
      } else if (ch === quote) {
        quote = null;
      }
    } else if (ch === "#") {
      return true;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    }
  }
  return quote === null;
}

export function validateTomlSyntax(src, label = "config.toml") {
  const problems = [];
  const lines = src.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (line.trim() === "") continue;
    if (!TOML_LINE.test(line)) {
      problems.push({ line: index + 1, message: `${label}:${index + 1}: invalid TOML syntax: ${line.trim()}` });
      continue;
    }
    if (!balancedStrings(line)) {
      problems.push({ line: index + 1, message: `${label}:${index + 1}: unterminated string: ${line.trim()}` });
    }
  }
  return problems;
}

export function bracketTables(src) {
  const tables = [];
  let current = null;
  const lines = src.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    if (/^\[\[?\s*\w/.test(trimmed)) {
      current = { header: trimmed, line: index + 1, keys: new Map() };
      tables.push(current);
      continue;
    }
    if (!current) continue;
    const match = trimmed.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
    if (match) current.keys.set(match[1], match[2].trim());
  }
  return tables;
}

export function validateBrackets(src, label = "config.toml") {
  const problems = [];
  const tables = bracketTables(src).filter((table) => table.header.startsWith("[["));
  tables.forEach((table, depthIndex) => {
    const name = table.header.replace(/^\[+|\]+$/g, "").trim();
    for (const key of ["start", "end", "close", "newline"]) {
      if (!table.keys.has(key)) {
        problems.push({
          line: table.line,
          message: `${label}:${table.line}: ${name}[${depthIndex + 1}] missing required Zed field "${key}"`,
        });
      }
    }
  });
  return problems;
}
