# Oracle PL/SQL for Zed

A [Zed](https://zed.dev) extension that adds `PL/SQL` language support: a Tree-sitter
grammar ([`njank/tree-sitter-plsql`](https://github.com/njank/tree-sitter-plsql), MIT),
syntax highlighting, bracket auto-closing, and comment toggling.

Status: early MVP (grammar + minimal highlights).

## Installation (dev extension)

1. In Zed, open the command palette and run `zed: install dev extension`, then select this repository's directory.
2. Open a file with one of these extensions: `.pls`, `.pks`, `.pkb`, `.prc`, `.fnc`, `.trg`, `.typ`. The status bar should show `PL/SQL`.

## Query validation

Tree-sitter queries name grammar nodes by hand, so a typo in `highlights.scm` silently
breaks highlighting in Zed. `scripts/validate-queries.mjs` catches that before you open
the editor: it parses the PL/SQL corpus in `corpus/plsql/`, then checks every node
referenced by the query files against the pinned grammar's `node-types.json`, checks that
each query compiles, and checks `config.toml` against the fields Zed requires on each
`[[brackets]]` entry. Capture names (`@keyword`, `@type.builtin`, ...) are not checked
against a Zed allow-list, so a mistyped capture name is only caught by eye.

```sh
node scripts/validate-queries.mjs        # exit 0 = all good, 1 = problems, 2 = setup problem
node --test tests/                       # unit + end-to-end tests for the validator
```

Requirements: the `tree-sitter` CLI on `PATH` (0.25 or newer — the CLI pinned by the
grammar's own `package.json` is too old to check modern queries) and a C compiler (the
script builds the parser from `grammars/plsql` and caches the library next to it).
`grammars/` is cloned by Zed on demand and is not committed, so clone
`njank/tree-sitter-plsql` at the commit pinned in `extension.toml` into `grammars/plsql`
first if it is missing. The script also warns when the checkout is not at that commit.

Options: `--query <file>` (repeatable), `--config <file>`, `--corpus <dir>`,
`--grammar <dir>`, `--no-parse`.

## Limitations

- Files with the `.sql` extension keep opening as SQL (Zed's SQL support). To open them
  as PL/SQL, use the language selector in the status bar or Zed's `file_types` setting.
- Files with no extension are detected as PL/SQL when their first line starts with
  `CREATE [OR REPLACE] PROCEDURE|FUNCTION|PACKAGE|TRIGGER|TYPE`. Files whose extension is
  already claimed by another language (e.g. `.sql`, `.txt`) keep that language.
- No language server: no completion, diagnostics, go-to-definition, or formatting.

## License

MIT. See [LICENSE](LICENSE).
